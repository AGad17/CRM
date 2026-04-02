import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requirePermission } from '@/lib/roleGuard'
import { prisma } from '@/lib/prisma'
import { getPricingConfig } from '@/lib/db/invoicing'
import { calcDealSummary, calcInvoiceDates, getQuarterNumber, generateInvoiceNumber } from '@/lib/invoicingCalc'
import { DEFAULT_TASKS } from '@/lib/db/onboarding'
import { logActivity } from '@/lib/activityLog'
import { getUSDRate } from '@/lib/exchange-rate'

export async function POST(request, { params }) {
  const { error } = await requirePermission('pipeline', 'edit')
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const session = await getServerSession(authOptions)
  const actor = { actorId: session?.user?.id, actorName: session?.user?.name || session?.user?.email }

  // Validate required fields
  const required = ['accountName', 'country', 'posSystem', 'package', 'paymentType', 'startDate', 'agentId']
  const missing = required.filter((k) => !body[k])
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
  }

  // Derive activationDate: use provided value or default to startDate + 1 month
  const activationDate = body.activationDate
    ? new Date(body.activationDate)
    : (() => { const d = new Date(body.startDate); d.setMonth(d.getMonth() + 1); return d })()

  try {

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

  // Fetch historical USD exchange rate for the deal's currency at start date
  // Done outside the transaction to avoid holding the DB connection during network I/O
  const usdRate = await getUSDRate(country.currency, body.startDate)

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
      // Save Foodics invoice number on the first invoice (index 0) if provided
      ...(i === 0 && body.foodicsInvoiceNumber
        ? { foodicsInvoiceNumber: body.foodicsInvoiceNumber }
        : {}),
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

      // 1b. Migrate brand names from lead to AccountBrand table
      const leadBrands = Array.isArray(lead.brandNames) ? lead.brandNames : []
      if (leadBrands.length > 0) {
        await tx.accountBrand.createMany({
          data: leadBrands.map((name) => ({ accountId: account.id, name })),
          skipDuplicates: true,
        })
        // Update brands count: for new accounts set it; for existing accounts add to it
        if (isExistingAccount) {
          await tx.account.update({
            where: { id: account.id },
            data:  { brands: { increment: leadBrands.length } },
          })
        } else {
          // New account was created with brands: Number(body.brands) || 1
          // Override with actual brand names count if available
          await tx.account.update({
            where: { id: account.id },
            data:  { brands: leadBrands.length },
          })
        }
      }

      // 2. Create Deal with nested Invoices
      const deal = await tx.deal.create({
        data: {
          startDate:               new Date(body.startDate),
          activationDate:          activationDate,
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
      let trackerId = null
      if (!isExistingAccount) {
        const tracker = await tx.onboardingTracker.create({
          data: {
            accountId:  account.id,
            dealId:     deal.id,
            startDate:  new Date(),
            goLiveDate: activationDate,
            tasks:      { create: DEFAULT_TASKS },
          },
        })
        trackerId = tracker.id
      } else {
        // Find the existing tracker for this account
        const existing = await tx.onboardingTracker.findUnique({ where: { accountId: account.id } })
        if (existing) trackerId = existing.id
      }

      // 4a. Auto-complete the "handover document" task in DealClosure phase (agent just filled it in)
      if (trackerId) {
        const handoverTask = await tx.onboardingTask.findFirst({
          where: {
            trackerId,
            phase: 'DealClosure',
            title: { contains: 'handover document', mode: 'insensitive' },
            completed: false,
          },
        })
        if (handoverTask) {
          await tx.onboardingTask.update({
            where: { id: handoverTask.id },
            data:  { completed: true, completedAt: new Date() },
          })
        }
      }

      // 4b. Create Handover Document
      const h = body.handover || {}
      await tx.handoverDocument.create({
        data: {
          dealId:                 deal.id,
          accountId:              account.id,
          clientName:             h.clientName             || body.accountName.trim(),
          contractStart:          h.contractStart          ? new Date(h.contractStart) : new Date(body.startDate),
          contractDuration:       h.contractDuration       || null,
          commercialModel:        h.commercialModel        || null,
          clientPoc:              h.clientPoc              || null,
          clientPocRole:          h.clientPocRole          || null,
          clientEmail:            h.clientEmail            || null,
          clientPhone:            h.clientPhone            || null,
          escalationContact:      h.escalationContact      || null,
          acquisitionOwner:       h.acquisitionOwner       || null,
          assignedCsManager:      h.assignedCsManager      || null,
          primaryObjectives:      h.primaryObjectives      || null,
          successMetrics:         h.successMetrics         || null,
          shortTermPriorities:    h.shortTermPriorities    || null,
          longTermPriorities:     h.longTermPriorities     || null,
          howTheyOperate:         h.howTheyOperate         || null,
          orderWorkflowSummary:   h.orderWorkflowSummary   || null,
          locationsOperatingHours:h.locationsOperatingHours|| null,
          keyNeeds:               h.keyNeeds               || null,
          topPainPoints:          h.topPainPoints          || null,
          currentSystemsUsed:     h.currentSystemsUsed     || null,
          requiredIntegrations:   h.requiredIntegrations   || null,
          inScope:                h.inScope                || null,
          outOfScope:             h.outOfScope             || null,
          dependenciesFromClient: h.dependenciesFromClient || null,
          highlights:             h.highlights             || null,
        },
      })

      // 5. Create Contract + ContractItems (locks annual unit prices at signing time)
      const CONTRACT_TYPE_MAP = { New: 'New', Renewal: 'Renewal', Upsell: 'Expansion', Expansion: 'Expansion' }
      const contractType = CONTRACT_TYPE_MAP[body.dealType] || 'New'
      const paymentPlan  = body.paymentType === 'Quarterly' ? 'Quarterly' : 'Yearly'
      // endDate = activationDate + contractMonths (subscription runs 12m from activation)
      const endDate = new Date(activationDate)
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

      const contract = await tx.contract.create({
        data: {
          accountId:     account.id,
          contractValue: summary.contractValue,
          startDate:      new Date(body.startDate),
          activationDate: activationDate,
          endDate,
          type:           contractType,
          usdRate:       usdRate ?? undefined,
          items:         { create: items },
        },
      })

      // Link deal → contract directly for traceability
      await tx.deal.update({
        where: { id: deal.id },
        data:  { contractId: contract.id },
      })

      return { account, deal }
    })

    await logActivity({
      entity: 'Lead', entityId: Number(id), accountId: result.account.id, action: 'closed_won',
      ...actor,
      meta: { dealId: result.deal.id, accountName: body.accountName },
    })
    await logActivity({
      entity: 'Deal', entityId: result.deal.id, accountId: result.account.id, action: 'created',
      ...actor,
      meta: { totalMRR: Number(result.deal.totalMRR), package: body.package },
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('[close-deal]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
