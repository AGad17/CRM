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

  // Fetch country
  const country = await prisma.country.findFirst({ where: { code: body.country } })
  if (!country) {
    return NextResponse.json({ error: `Country not found: ${body.country}` }, { status: 400 })
  }

  // Load pricing config (new: inventoryPricing + addOnPricing)
  const config      = await getPricingConfig()
  const vatRate     = Number(country.vatRate || 0)
  const contractYears = Number(body.contractYears) || 1
  const salesChannel  = body.salesChannel || lead.channel || 'DirectSales'
  const discount      = Number(body.discount) || 0
  const lineDiscounts = body.lineDiscounts || {}

  // Calculate deal summary with new pricing engine
  const summary = calcDealSummary({
    normalBranches:          Number(body.normalBranches)          || 0,
    centralKitchens:         Number(body.centralKitchens)         || 0,
    warehouses:              Number(body.warehouses)              || 0,
    hasAccounting:           !!body.hasAccounting,
    extraAccountingBranches: Number(body.extraAccountingBranches) || 0,
    hasButchering:           !!body.hasButchering,
    aiAgentUsers:            Number(body.aiAgentUsers)            || 0,
    countryCode:             body.country,
    salesChannel,
    package:                 body.package,
    paymentType:             body.paymentType,
    contractYears,
    vatRate,
    discount,
    lineDiscounts,
    inventoryPricing:        config.inventoryPricing,
    addOnPricing:            config.addOnPricing,
  })

  // effectiveAnnual is the post-discount, post-premium annual value
  const invoiceDates = calcInvoiceDates(
    body.startDate,
    body.paymentType,
    summary.effectiveAnnual,
    contractYears
  )

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

  // Determine if this is an expansion/renewal (existing account) or new
  const isExistingAccount = !!lead.accountId

  // Prevent duplicate account names for New opportunities
  if (!isExistingAccount) {
    const existing = await prisma.account.findFirst({
      where: { name: { equals: body.accountName.trim(), mode: 'insensitive' } },
      select: { id: true, name: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: `An account named "${existing.name}" already exists (ID #${existing.id}). Use Expansion or Renewal instead.` },
        { status: 409 }
      )
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let account

      if (isExistingAccount) {
        // Expansion / Renewal — use the already-linked account
        account = await tx.account.findUnique({ where: { id: lead.accountId } })
        if (!account) throw new Error('Linked account not found')
      } else {
        // New — create the account
        account = await tx.account.create({
          data: {
            name:                body.accountName.trim(),
            leadSource:          lead.channel,
            countryId:           country.id,
            brands:              Number(body.brands)             || 1,
            numberOfBranches:    Number(body.numberOfBranches)   || 1,
            numberOfCostCentres: body.numberOfCostCentres ? Number(body.numberOfCostCentres) : null,
          },
        })
      }

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
          salesChannel:            salesChannel,
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
          discount:                discount || null,
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

      // 4. Create Onboarding Tracker (new accounts only — existing accounts are already onboarded)
      if (!isExistingAccount) {
        await tx.onboardingTracker.create({
          data: {
            accountId: account.id,
            dealId:    deal.id,
            startDate: new Date(),
            tasks:     { create: DEFAULT_TASKS },
          },
        })
      }

      // 5. Create Contract + ContractItems (locks annual unit prices at signing time)
      const CONTRACT_TYPE_MAP = { New: 'New', Renewal: 'Renewal', Upsell: 'Expansion', Expansion: 'Expansion' }
      const contractType = CONTRACT_TYPE_MAP[body.dealType] || 'New'
      const paymentPlan  = body.paymentType === 'Quarterly' ? 'Quarterly' : 'Yearly'
      const endDate      = new Date(body.startDate)
      endDate.setMonth(endDate.getMonth() + summary.contractMonths)

      const items = []
      const cc  = body.country
      const ch  = salesChannel
      const pkg = body.package
      const months = summary.contractMonths

      // Helper to get annual price per unit from new pricing tables
      function getInvAnnualPrice() {
        const row = config.inventoryPricing.find(
          (r) => r.countryCode === cc && r.salesChannel === ch && r.package === pkg
        )
        return Number(row?.annualPrice || 0)
      }
      function getAddOnAnnualPrice(module) {
        const row = config.addOnPricing.find(
          (r) => r.countryCode === cc && r.salesChannel === ch && r.module === module
        )
        return Number(row?.annualPrice || 0)
      }

      // Build line items using annual unit price × qty × (months/12), with per-line discount
      function lineTotal(annualUnitPrice, qty, lineDiscPct) {
        const effective = annualUnitPrice * (1 - Number(lineDiscPct || 0) / 100)
        return effective * qty * months / 12
      }

      const normalBranches = Number(body.normalBranches) || 0
      const ckBranches     = Number(body.centralKitchens) || 0
      const warehouses     = Number(body.warehouses) || 0

      if (normalBranches > 0) {
        const unitPrice = getInvAnnualPrice()
        items.push({
          description: `${pkg} Plan – Normal Branches`,
          quantity:    normalBranches,
          unitPrice:   unitPrice / 12,  // store as monthly equivalent
          discountPct: Number(lineDiscounts.inventory) || null,
          paymentPlan,
          lineTotal:   lineTotal(unitPrice, normalBranches, lineDiscounts.inventory),
        })
      }
      if (ckBranches > 0) {
        const unitPrice = getAddOnAnnualPrice('CentralKitchen')
        items.push({
          description: 'Central Kitchen Branches',
          quantity:    ckBranches,
          unitPrice:   unitPrice / 12,
          discountPct: Number(lineDiscounts.ck) || null,
          paymentPlan,
          lineTotal:   lineTotal(unitPrice, ckBranches, lineDiscounts.ck),
        })
      }
      if (warehouses > 0) {
        const unitPrice = getAddOnAnnualPrice('Warehouse')
        items.push({
          description: 'Warehouse Branches',
          quantity:    warehouses,
          unitPrice:   unitPrice / 12,
          discountPct: Number(lineDiscounts.warehouse) || null,
          paymentPlan,
          lineTotal:   lineTotal(unitPrice, warehouses, lineDiscounts.warehouse),
        })
      }
      if (body.hasAccounting) {
        const unitPrice = getAddOnAnnualPrice('AccountingMain')
        items.push({
          description: 'Accounting Module (Main License)',
          quantity:    1,
          unitPrice:   unitPrice / 12,
          discountPct: Number(lineDiscounts.accMain) || null,
          paymentPlan,
          lineTotal:   lineTotal(unitPrice, 1, lineDiscounts.accMain),
        })
        const extraBranches = Number(body.extraAccountingBranches) || 0
        if (extraBranches > 0) {
          const extraPrice = getAddOnAnnualPrice('AccountingExtra')
          items.push({
            description: 'Accounting Module (Extra Branches)',
            quantity:    extraBranches,
            unitPrice:   extraPrice / 12,
            discountPct: Number(lineDiscounts.accExtra) || null,
            paymentPlan,
            lineTotal:   lineTotal(extraPrice, extraBranches, lineDiscounts.accExtra),
          })
        }
      }
      if (body.hasButchering) {
        const unitPrice = getAddOnAnnualPrice('Butchering')
        items.push({
          description: 'Butchering Module',
          quantity:    1,
          unitPrice:   unitPrice / 12,
          discountPct: Number(lineDiscounts.butchering) || null,
          paymentPlan,
          lineTotal:   lineTotal(unitPrice, 1, lineDiscounts.butchering),
        })
      }
      const aiUsers = Number(body.aiAgentUsers) || 0
      if (aiUsers > 0) {
        const unitPrice = getAddOnAnnualPrice('AIAgent')
        items.push({
          description: 'AI Agent Named Users',
          quantity:    aiUsers,
          unitPrice:   unitPrice / 12,
          discountPct: Number(lineDiscounts.ai) || null,
          paymentPlan,
          lineTotal:   lineTotal(unitPrice, aiUsers, lineDiscounts.ai),
        })
      }

      await tx.contract.create({
        data: {
          accountId:     account.id,
          contractValue: summary.contractValue,
          startDate:     new Date(body.startDate),
          endDate,
          type:          contractType,
          items:         { create: items },
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
