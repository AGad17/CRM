/**
 * import-data.js
 *
 * Imports accounts, contracts + line items, and pipeline leads
 * from CSV files in /data-templates/.
 *
 * Process order:
 *   1. accounts.csv          → creates Account records
 *   2. contracts.csv         → creates Contract records (matched by account_name)
 *   3. contract-items.csv    → creates ContractItem records (matched by account_name + contract_start_date)
 *   4. leads.csv             → creates Lead records (matched by owner_email → User)
 *
 * Usage:
 *   node scripts/import-data.js
 *   node scripts/import-data.js --dry-run   ← validate without writing
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as XLSX from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const TEMPLATES = resolve(ROOT, 'data-templates')
const DRY = process.argv.includes('--dry-run')

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// ── Helpers ───────────────────────────────────────────────────────────────────

function readCsv(filename) {
  const filepath = resolve(TEMPLATES, filename)
  if (!existsSync(filepath)) {
    console.warn(`   ⚠  ${filename} not found — skipping`)
    return []
  }
  const wb = XLSX.readFile(filepath, { raw: false, dateNF: 'yyyy-mm-dd' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  // Strip rows that are entirely empty or comment rows (starting with #)
  return rows.filter((r) => {
    const vals = Object.values(r).map(String)
    return vals.some((v) => v.trim() && !v.trim().startsWith('#'))
  })
}

function parseDate(val) {
  if (!val) return null
  const s = String(val).trim()
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d)) throw new Error(`Invalid date: "${s}" — expected YYYY-MM-DD`)
  return d
}

function req(row, field) {
  const v = String(row[field] || '').trim()
  if (!v) throw new Error(`Required field "${field}" is empty`)
  return v
}

function num(val, fallback = 0) {
  const n = parseFloat(String(val).replace(/,/g, ''))
  return isNaN(n) ? fallback : n
}

function int(val, fallback = 1) {
  const n = parseInt(String(val).replace(/,/g, ''), 10)
  return isNaN(n) ? fallback : n
}

// Valid enum values
const LEAD_SOURCES  = ['Foodics','EmployeeReferral','CustomerReferral','PartnerReferral','Website','AmbassadorReferral','DirectSales','Sonic','Historical']
const CONTRACT_TYPES = ['New','Renewal','Expansion']
const PAYMENT_PLANS  = ['Yearly','Quarterly','OneTime']
const LEAD_STAGES    = ['Lead','Qualified','ClosedWon','ClosedLost','Churned']
const DEAL_TYPES     = ['New','Renewal','Upsell','Expansion']
const PACKAGES       = ['Essential','Operations','Enterprise']

function enumVal(val, allowed, field) {
  const v = String(val || '').trim()
  if (!v) return null
  const match = allowed.find((a) => a.toLowerCase() === v.toLowerCase())
  if (!match) throw new Error(`"${v}" is not valid for ${field}. Allowed: ${allowed.join(', ')}`)
  return match
}

// ── Step 1: Accounts ──────────────────────────────────────────────────────────

async function importAccounts() {
  const rows = readCsv('accounts.csv')
  if (!rows.length) { console.log('   ℹ  accounts.csv is empty — no accounts created'); return {} }

  // Load countries for ID lookup
  const countries = await prisma.country.findMany()
  const countryByCode = Object.fromEntries(countries.map((c) => [c.code.toLowerCase(), c]))
  const countryByName = Object.fromEntries(countries.map((c) => [c.name.toLowerCase(), c]))

  const accountMap = {} // account_name → Account
  let created = 0, errors = 0

  for (const [i, row] of rows.entries()) {
    const lineNo = i + 2 // 1 header row
    try {
      const name       = req(row, 'account_name')
      const countryRaw = req(row, 'country')
      const leadSrc    = enumVal(req(row, 'lead_source'), LEAD_SOURCES, 'lead_source')

      // Resolve country
      const country = countryByCode[countryRaw.toLowerCase()] || countryByName[countryRaw.toLowerCase()]
      if (!country) throw new Error(`Country "${countryRaw}" not found. Available: ${countries.map(c=>c.name).join(', ')}`)

      const payload = {
        name,
        countryId:          country.id,
        leadSource:         leadSrc,
        brands:             int(row.brands, 1),
        numberOfBranches:   int(row.branches, 1),
        numberOfCostCentres: row.cost_centres ? int(row.cost_centres) : null,
        externalCode:       row.external_code ? String(row.external_code).trim() : null,
      }

      if (DRY) {
        console.log(`   [DRY] Account: ${name} (${country.code})`)
      } else {
        const acc = await prisma.account.create({ data: payload })
        accountMap[name.toLowerCase()] = acc
      }
      created++
    } catch (e) {
      console.error(`   ✗  accounts.csv row ${lineNo}: ${e.message}`)
      errors++
    }
  }

  console.log(`   Accounts   — ${created} imported${errors ? `, ${errors} errors` : ''}`)
  return accountMap
}

// ── Step 2: Contracts ─────────────────────────────────────────────────────────

async function importContracts(accountMap) {
  const rows = readCsv('contracts.csv')
  if (!rows.length) { console.log('   ℹ  contracts.csv is empty — no contracts created'); return {} }

  // If we did a dry run, accountMap is empty — reload from DB
  if (!Object.keys(accountMap).length) {
    const accounts = await prisma.account.findMany()
    for (const a of accounts) accountMap[a.name.toLowerCase()] = a
  }

  const contractMap = {} // `${accName.lower}__${startDate}` → Contract
  let created = 0, errors = 0

  for (const [i, row] of rows.entries()) {
    const lineNo = i + 2
    try {
      const accName = req(row, 'account_name')
      const account = accountMap[accName.toLowerCase()]
      if (!account) throw new Error(`Account "${accName}" not found — make sure it exists in accounts.csv`)

      const type      = enumVal(req(row, 'contract_type'), CONTRACT_TYPES, 'contract_type')
      const startDate = parseDate(req(row, 'start_date'))
      const endDate   = parseDate(req(row, 'end_date'))
      const value     = num(req(row, 'contract_value'))
      const usdRate   = row.usd_rate ? num(row.usd_rate) : null
      const cancelDate = parseDate(row.cancellation_date)

      const key = `${accName.toLowerCase()}__${row.start_date.trim()}`

      const payload = {
        accountId:        account.id,
        type,
        startDate,
        endDate,
        contractValue:    value,
        usdRate,
        cancellationDate: cancelDate,
      }

      if (DRY) {
        console.log(`   [DRY] Contract: ${accName} | ${type} | ${row.start_date} → ${row.end_date} | Value: ${value}`)
      } else {
        const contract = await prisma.contract.create({ data: payload })
        contractMap[key] = contract
      }
      created++
    } catch (e) {
      console.error(`   ✗  contracts.csv row ${lineNo}: ${e.message}`)
      errors++
    }
  }

  console.log(`   Contracts  — ${created} imported${errors ? `, ${errors} errors` : ''}`)
  return contractMap
}

// ── Step 3: Contract Items ────────────────────────────────────────────────────

async function importContractItems(contractMap) {
  const rows = readCsv('contract-items.csv')
  if (!rows.length) { console.log('   ℹ  contract-items.csv is empty — no items created'); return }

  // If dry run / map empty, rebuild from DB
  if (!Object.keys(contractMap).length) {
    const contracts = await prisma.contract.findMany({ include: { account: true } })
    for (const c of contracts) {
      const key = `${c.account.name.toLowerCase()}__${c.startDate.toISOString().slice(0, 10)}`
      contractMap[key] = c
    }
  }

  let created = 0, errors = 0

  for (const [i, row] of rows.entries()) {
    const lineNo = i + 2
    try {
      const accName   = req(row, 'account_name')
      const startDate = req(row, 'contract_start_date')
      const key       = `${accName.toLowerCase()}__${startDate.trim()}`
      const contract  = contractMap[key]
      if (!contract) throw new Error(`No contract found for account "${accName}" starting on "${startDate}"`)

      const plan = enumVal(req(row, 'payment_plan'), PAYMENT_PLANS, 'payment_plan')
      const qty  = int(row.quantity, 1)
      const unit = num(req(row, 'unit_price'))
      const disc = row.discount_pct ? num(row.discount_pct) : null
      const line = disc ? unit * qty * (1 - disc / 100) : unit * qty

      const payload = {
        contractId:  contract.id,
        description: req(row, 'description'),
        quantity:    qty,
        unitPrice:   unit,
        discountPct: disc,
        paymentPlan: plan,
        lineTotal:   line,
      }

      if (DRY) {
        console.log(`   [DRY] Item: ${accName} | ${row.description} | Qty ${qty} × ${unit} (${plan})`)
      } else {
        await prisma.contractItem.create({ data: payload })
      }
      created++
    } catch (e) {
      console.error(`   ✗  contract-items.csv row ${lineNo}: ${e.message}`)
      errors++
    }
  }

  console.log(`   Items      — ${created} imported${errors ? `, ${errors} errors` : ''}`)
}

// ── Step 4: Leads ─────────────────────────────────────────────────────────────

async function importLeads(accountMap) {
  const rows = readCsv('leads.csv')
  if (!rows.length) { console.log('   ℹ  leads.csv is empty — no leads created'); return }

  // Load users for owner lookup
  const users = await prisma.user.findMany()
  const userByEmail = Object.fromEntries(users.map((u) => [u.email.toLowerCase(), u]))

  // Reload accounts if needed
  if (!Object.keys(accountMap).length) {
    const accounts = await prisma.account.findMany()
    for (const a of accounts) accountMap[a.name.toLowerCase()] = a
  }

  let created = 0, errors = 0

  for (const [i, row] of rows.entries()) {
    const lineNo = i + 2
    try {
      const ownerEmail = req(row, 'owner_email').toLowerCase()
      const owner = userByEmail[ownerEmail]
      if (!owner) throw new Error(`User with email "${ownerEmail}" not found. Available: ${users.map(u=>u.email).join(', ')}`)

      const channel = enumVal(req(row, 'channel'), LEAD_SOURCES, 'channel')
      const stage   = row.stage ? enumVal(row.stage, LEAD_STAGES, 'stage') : 'Lead'

      // Optional account link
      const accName = String(row.account_name || '').trim()
      const account = accName ? accountMap[accName.toLowerCase()] : null

      const payload = {
        companyName:      req(row, 'company_name'),
        contactName:      row.contact_name  ? String(row.contact_name).trim()  : null,
        contactEmail:     row.contact_email ? String(row.contact_email).trim() : null,
        contactPhone:     row.contact_phone ? String(row.contact_phone).trim() : null,
        channel,
        countryCode:      row.country ? String(row.country).trim() : null,
        estimatedValue:   row.estimated_value ? num(row.estimated_value) : null,
        numberOfBranches: row.branches ? int(row.branches) : null,
        packageInterest:  row.package_interest ? enumVal(row.package_interest, PACKAGES, 'package_interest') : null,
        stage,
        lostReason:       row.lost_reason    ? String(row.lost_reason).trim()    : null,
        notes:            row.notes          ? String(row.notes).trim()           : null,
        expectedCloseDate: parseDate(row.expected_close_date),
        opportunityType:  row.opportunity_type ? enumVal(row.opportunity_type, DEAL_TYPES, 'opportunity_type') : null,
        ownerId:          owner.id,
        accountId:        account?.id ?? null,
      }

      if (DRY) {
        console.log(`   [DRY] Lead: ${payload.companyName} | ${channel} | ${stage} → ${owner.email}`)
      } else {
        await prisma.lead.create({ data: payload })
      }
      created++
    } catch (e) {
      console.error(`   ✗  leads.csv row ${lineNo}: ${e.message}`)
      errors++
    }
  }

  console.log(`   Leads      — ${created} imported${errors ? `, ${errors} errors` : ''}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📥  ShopBrain CRM — Data Import${DRY ? ' (DRY RUN)' : ''}\n`)
  console.log(`   Reading templates from: ${TEMPLATES}\n`)

  const accountMap  = await importAccounts()
  const contractMap = await importContracts(accountMap)
  await importContractItems(contractMap)
  await importLeads(accountMap)

  console.log(`\n✅  Import ${DRY ? 'validation' : ''} complete.\n`)
  if (!DRY) {
    console.log('   Open the CRM and verify your data at /dashboard\n')
  } else {
    console.log('   No errors? Re-run without --dry-run to commit the data.\n')
  }
}

main()
  .catch((e) => { console.error('\n❌ Fatal error:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
