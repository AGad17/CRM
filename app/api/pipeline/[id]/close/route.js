import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { prisma } from '@/lib/prisma'
import { getPricingConfig } from '@/lib/db/invoicing'
import { calcDealSummary, calcInvoiceDates, getQuarterNumber, generateInvoiceNumber } from '@/lib/invoicingCalc'
import { DEFAULT_TASKS } from '@/lib/db/onboarding'

export async function POST(request, { params }) {
  const { error } = await requireAuth('write')
  if (error) return error

  const { id } = await params
  const body = await request.json()

  // Validate required fields
  const required = ['accountName', 'country', 'posSystem', 'package', 'paymentType', 'startDate', 'agentId']
  const missing = required.filter((k) => !body[k])
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
  }

  // Fetch lead
  const lead = await prisma.lead.findUnique({ where: { id: Number(id) } })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  if (lead.stage === 'ClosedWon') {
    return NextResponse.json({ error: 'Lead is already closed' }, { status: 400 })
  }

  // Fetch country by code (full name in this DB, e.g. "Egypt", "KSA")
  const country = await prisma.country.findFirst({ where: { code: body.country } })
  if (!country) {
    return NextResponse.json({ error: `Country not found: ${body.country}` }, { status: 400 })
  }

  // Load pricing config and calculate deal summary
  const config = await getPricingConfig()
  const vatRate = Number(country.vatRate || 0)
  const contractYears = Number(body.contractYears) || 1

  const summary = calcDealSummary({
    normalBranches:          Number(body.normalBranches)          || 0,
    centralKitchens:         Number(body.centralKitchens)         || 0,
    warehouses:              Number(body.warehouses)              || 0,
    hasAccounting:           !!body.hasAccounting,
    extraAccountingBranches: Number(body.extraAccountingBranches) || 0,
    hasButchering:           !!body.hasButchering,
    aiAgentUsers:            Number(body.aiAgentUsers)            || 0,
    countryCode:             body.country,
    package:                 body.package,
    paymentType:             body.paymentType,
    contractYears,
    vatRate,
    branchPricing:           config.branchPricing,
    accountingPricing:       config.accountingPricing,
    flatModulePricing:       config.flatModulePricing,
  })

  const invoiceDates = calcInvoiceDates(body.startDate, body.paymentType, summary.totalMRR, contractYears)

  // Pre-generate unique invoice numbers (with collision retry)
  const invoiceNumbers = []
  for (const inv of invoiceDates) {
    let num = null
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = generateInvoiceNumber(inv.invoiceDate)
      const exists = await prisma.invoice.findUnique({ where: { invoiceNumber: candidate } })
      if (!exists) { num = candidate; break }
    }
    if (!num) return NextResponse.json({ error: 'Failed to generate unique invoice number' }, { status: 500 })
    invoiceNumbers.push(num)
  }

  // Build invoice rows
  const isFoodics = body.posSystem === 'Foodics'
  const invoiceRows = invoiceDates.map((inv, i) => {
    const vatAmount     = inv.amountExclVAT * vatRate
    const amountInclVAT = inv.amountExclVAT + vatAmount
    const eligibleCollectionDate = isFoodics
      ? new Date(new Date(inv.invoiceDate).getTime() + 38 * 86400000)
      : null
    return {
      invoiceNumber:          invoiceNumbers[i],
      accountName:            body.accountName.trim(),
      posSystem:              body.posSystem,
      countryCode:            body.country,
      paymentType:            body.paymentType,
      dealDate:               new Date(body.startDate),
      invoiceDate:            new Date(inv.invoiceDate),
      quarterNumber:          getQuarterNumber(inv.invoiceDate),
      amountExclVAT:          inv.amountExclVAT,
      vatRate,
      vatAmount,
      amountInclVAT,
      eligibleCollectionDate,
      status:                 'Pending',
    }
  })

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Account
      const account = await tx.account.create({
        data: {
          name:                body.accountName.trim(),
          leadSource:          lead.channel,
          countryId:           country.id,
          brands:              Number(body.brands)             || 1,
          numberOfBranches:    Number(body.numberOfBranches)   || 1,
          numberOfCostCentres: body.numberOfCostCentres ? Number(body.numberOfCostCentres) : null,
        },
      })

      // 2. Create Deal with nested Invoices
      const deal = await tx.deal.create({
        data: {
          startDate:               new Date(body.startDate),
          agentId:                 body.agentId,
          accountName:             body.accountName.trim(),
          brandNames:              body.brandNames || body.accountName.trim(),
          numberOfBrands:          Number(body.numberOfBrands)          || 1,
          dealType:                body.dealType   || 'New',
          posSystem:               body.posSystem,
          countryCode:             body.country,
          salesChannel:            body.salesChannel  || null,
          package:                 body.package,
          paymentType:             body.paymentType,
          contractYears:           body.paymentType === 'Special' ? contractYears : null,
          normalBranches:          Number(body.normalBranches)          || 0,
          centralKitchens:         Number(body.centralKitchens)         || 0,
          warehouses:              Number(body.warehouses)              || 0,
          hasAccounting:           !!body.hasAccounting,
          extraAccountingBranches: Number(body.extraAccountingBranches) || 0,
          hasButchering:           !!body.hasButchering,
          aiAgentUsers:            Number(body.aiAgentUsers)            || 0,
          notes:                   body.notes || null,
          totalMRR:                summary.totalMRR,
          vatRate,
          totalMRRInclVAT:         summary.totalMRRInclVAT,
          contractMonths:          summary.contractMonths,
          contractValue:           summary.contractValue,
          contractValueInclVAT:    summary.contractValueInclVAT,
          accountId:               account.id,
          invoices:                { create: invoiceRows },
        },
        include: {
          agent:    { select: { id: true, name: true, email: true } },
          invoices: true,
        },
      })

      // 3. Mark lead as Closed Won and link account
      await tx.lead.update({
        where: { id: Number(id) },
        data:  { stage: 'ClosedWon', convertedAt: new Date(), accountId: account.id },
      })

      // 4. Create Onboarding Tracker with default tasks
      await tx.onboardingTracker.create({
        data: {
          accountId: account.id,
          dealId:    deal.id,
          startDate: new Date(),
          tasks:     { create: DEFAULT_TASKS },
        },
      })

      return { account, deal }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('[close-deal]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
