/**
 * migrate-excel.mjs
 * Imports historical deals from "Deals Insights.xlsx" → Revenue_Data sheet.
 * Creates: Account + Deal (no invoices).
 * Idempotent: skips accounts/deals that already exist.
 *
 * Usage: node scripts/migrate-excel.mjs
 */

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const XLSX = require(resolve(__dirname, '../node_modules/xlsx/xlsx.js'))

// Load .env manually (avoid dotenv dependency)
const envPath = resolve(__dirname, '../.env')
const envFile = readFileSync(envPath, 'utf8')
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const val = match[2].trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

const { PrismaClient } = await import('@prisma/client')
const { PrismaPg } = await import('@prisma/adapter-pg')

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// ─── Constants ───────────────────────────────────────────────────────────────

const EXCEL_FILE = '/Users/ahmedgad/Downloads/Deals Insights.xlsx'

const COUNTRY_MAP = {
  Egypt:   'Egypt',
  KSA:     'KSA',
  UAE:     'UAE',
  Bahrain: 'Bahrain',
  Jordan:  'Jordan',
}

const DEAL_TYPE_MAP = {
  New:       'New',
  Renewal:   'Renewal',
  Expansion: 'Expansion',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function excelToDate(serial) {
  if (!serial || typeof serial !== 'number') return null
  return new Date(Math.round((serial - 25569) * 86400 * 1000))
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📂 Reading Excel file…')
  const wb = XLSX.readFile(EXCEL_FILE)
  const ws = wb.Sheets['Revenue_Data']
  const allRows = XLSX.utils.sheet_to_json(ws, { defval: null })

  const rows = allRows.filter(
    (r) => r.Account_code != null && r.Country != null && r.Start_date != null
  )
  console.log(`✅ Valid rows: ${rows.length}`)

  const countries = await prisma.country.findMany({ where: { isActive: true } })
  const countryByCode = Object.fromEntries(countries.map((c) => [c.code, c]))

  const existingAccounts = await prisma.account.findMany({
    where: { externalCode: { not: null } },
    select: { id: true, externalCode: true },
  })
  const accountByExternalCode = Object.fromEntries(
    existingAccounts.map((a) => [a.externalCode, a])
  )

  // Group rows by Account_code — pick max branches across contracts
  const accountMap = {}
  for (const row of rows) {
    const code = String(row.Account_code)
    if (!accountMap[code]) {
      accountMap[code] = { name: row.Account_Name, country: row.Country, maxBranches: 0 }
    }
    const branches = Number(row.Number_of_branches) || 1
    if (branches > accountMap[code].maxBranches) accountMap[code].maxBranches = branches
  }

  // ── Step 1: Upsert Accounts ──────────────────────────────────────────────
  console.log('\n📋 Creating/verifying accounts…')
  let accountsCreated = 0, accountsSkipped = 0
  const accountIdByCode = {}

  for (const [code, { name, country, maxBranches }] of Object.entries(accountMap)) {
    const countryCode = COUNTRY_MAP[country]
    if (!countryCode) { console.warn(`  ⚠️  Unknown country "${country}" — skipping`); continue }
    const dbCountry = countryByCode[countryCode]
    if (!dbCountry) { console.warn(`  ⚠️  Country "${countryCode}" not in DB — skipping`); continue }

    if (accountByExternalCode[code]) {
      accountIdByCode[code] = accountByExternalCode[code].id
      accountsSkipped++
      continue
    }

    const account = await prisma.account.create({
      data: {
        name,
        leadSource:       'Historical',
        countryId:        dbCountry.id,
        numberOfBranches: maxBranches || 1,
        brands:           1,
        externalCode:     code,
      },
    })
    accountIdByCode[code] = account.id
    accountsCreated++
  }

  console.log(`  ✅ Created: ${accountsCreated}  Skipped (existing): ${accountsSkipped}`)

  // ── Step 2: Create Deals ─────────────────────────────────────────────────
  console.log('\n💼 Creating deals…')
  let dealsCreated = 0, dealsSkipped = 0, dealsFailed = 0

  for (const row of rows) {
    const code = String(row.Account_code)
    const accountId = accountIdByCode[code]
    if (!accountId) continue

    const startDate = excelToDate(row.Start_date)
    if (!startDate) continue

    const countryCode = COUNTRY_MAP[row.Country]
    if (!countryCode) continue

    const dbCountry = countryByCode[countryCode]
    const vatRate = dbCountry ? Number(dbCountry.vatRate || 0) : 0

    const existing = await prisma.deal.findFirst({
      where: { accountId, startDate, isHistorical: true },
    })
    if (existing) { dealsSkipped++; continue }

    const contractMonths  = Number(row.Contract_Period) || 12
    const paymentType     = contractMonths === 12 ? 'Annual' : 'Special'
    const contractYears   = Math.max(1, Math.round(contractMonths / 12))
    const mrrExclVAT      = Number(row.MRR) || 0
    const cvExclVAT       = Number(row.Contract_Value) || 0
    const dealType        = DEAL_TYPE_MAP[row.New_Expansion_Renewal] || 'New'
    const normalBranches  = Number(row.Number_of_branches) || 1

    try {
      await prisma.deal.create({
        data: {
          startDate,
          agentId:                 null,
          accountName:             row.Account_Name,
          brandNames:              null,
          numberOfBrands:          1,
          dealType,
          posSystem:               null,
          countryCode,
          salesChannel:            null,
          package:                 null,
          paymentType,
          contractYears,
          normalBranches,
          centralKitchens:         0,
          warehouses:              0,
          hasAccounting:           false,
          extraAccountingBranches: 0,
          hasButchering:           false,
          aiAgentUsers:            0,
          discount:                null,
          totalMRR:                mrrExclVAT,
          vatRate,
          totalMRRInclVAT:         mrrExclVAT * (1 + vatRate),
          contractMonths,
          contractValue:           cvExclVAT,
          contractValueInclVAT:    cvExclVAT * (1 + vatRate),
          accountId,
          isHistorical:            true,
        },
      })
      dealsCreated++
    } catch (err) {
      console.error(`  ❌ Deal for "${row.Account_Name}" (${code}):`, err.message)
      dealsFailed++
    }
  }

  console.log(`  ✅ Created: ${dealsCreated}  Skipped (existing): ${dealsSkipped}  Failed: ${dealsFailed}`)
  console.log('\n🎉 Migration complete.')
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
