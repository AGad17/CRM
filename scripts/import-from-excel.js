/**
 * import-from-excel.js
 *
 * Imports accounts, contracts, contract items, and brand names
 * from "CCO Reporting KPIs (2).xlsx"
 *
 * Usage:
 *   node scripts/import-from-excel.js               ← real import
 *   node scripts/import-from-excel.js --dry-run      ← validate without writing
 */

import 'dotenv/config'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require   = createRequire(import.meta.url)
const XLSX      = require(path.join(__dirname, '../node_modules/xlsx/xlsx.js'))

const DRY_RUN = process.argv.includes('--dry-run')
const EXCEL_FILE = path.join(__dirname, '../../../Downloads/CCO Reporting KPIs (2).xlsx')

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma  = new PrismaClient({ adapter })

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert Excel date serial → JS Date (UTC midnight) */
function excelDateToJS(serial) {
  if (!serial || typeof serial !== 'number') return null
  return new Date(Math.round((serial - 25569) * 86400 * 1000))
}

/** Add N months to a Date, returns new Date */
function addMonths(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

/** Normalise lead source: "Employee Referral" → "EmployeeReferral" */
const LEAD_SOURCE_MAP = {
  'Employee Referral':   'EmployeeReferral',
  'Customer Referral':   'CustomerReferral',
  'Partner Referral':    'PartnerReferral',
  'Ambassador Referral': 'AmbassadorReferral',
  'Direct Sales':        'DirectSales',
  'Foodics':             'Foodics',
  'Website':             'Website',
  'Sonic':               'Sonic',
  'Historical':          'Historical',
}

/** ContractType mapping */
const CONTRACT_TYPE_MAP = {
  'New':       'New',
  'Renewal':   'Renewal',
  'Expansion': 'Expansion',
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '\n🔍  DRY RUN — nothing will be written\n' : '\n📥  Importing data from Excel…\n')

  // Load Excel workbook
  const wb       = XLSX.readFile(EXCEL_FILE)
  const accRows  = XLSX.utils.sheet_to_json(wb.Sheets['Accounts'], { raw: true })
  const revRows  = XLSX.utils.sheet_to_json(wb.Sheets['Revenue'],  { raw: true })

  console.log(`   Excel loaded: ${accRows.length} account rows, ${revRows.length} revenue rows`)

  // Load country lookup
  const countries = await prisma.country.findMany()
  const countryByCode = {}
  countries.forEach(c => { countryByCode[c.code] = c })

  // ── STEP 1 — Import Accounts ────────────────────────────────────────────────
  console.log('\n── Step 1: Accounts ──')
  const accountByCode = {}     // externalCode → Account DB record
  let accCreated = 0, accSkipped = 0

  for (const row of accRows) {
    const name       = (row['Account Name'] || '').toString().trim()
    const code       = row['Account Code']?.toString().trim()
    const leadSrcRaw = (row['Lead Source'] || '').toString().trim()
    const countryRaw = (row['Country']     || '').toString().trim()
    const brands     = row['Brands'] ? parseInt(row['Brands'], 10) : 1
    const branches   = row['Number of Branches'] ? parseInt(row['Number of Branches'], 10) : 1

    if (!name || !code) { console.warn(`   ⚠️  Skipping row with missing name/code: ${JSON.stringify(row)}`); continue }

    const leadSource = LEAD_SOURCE_MAP[leadSrcRaw]
    if (!leadSource) { console.warn(`   ⚠️  Unknown lead source "${leadSrcRaw}" for "${name}" — skipping`); continue }

    const country = countryByCode[countryRaw]
    if (!country) { console.warn(`   ⚠️  Unknown country "${countryRaw}" for "${name}" — skipping`); continue }

    if (DRY_RUN) {
      console.log(`   [DRY] Account: "${name}" | src=${leadSource} | country=${countryRaw} | brands=${brands} | branches=${branches}`)
      accountByCode[code] = { id: `dry_${code}`, name }
      accCreated++
      continue
    }

    const acc = await prisma.account.create({
      data: {
        name,
        leadSource,
        countryId: country.id,
        brands,
        numberOfBranches: branches,
        externalCode: code,
      }
    })
    accountByCode[code] = acc
    accCreated++
  }

  console.log(`   ✓  Accounts created: ${accCreated}  (skipped: ${accSkipped})`)

  // Build parent-name lookup (code → account name from Accounts sheet)
  const parentNameByCode = {}
  accRows.forEach(r => {
    const code = r['Account Code']?.toString().trim()
    const name = (r['Account Name'] || '').toString().trim()
    if (code && name) parentNameByCode[code] = name
  })

  // ── STEP 2 — Import Contracts + Items + Brands ──────────────────────────────
  console.log('\n── Step 2: Contracts, Items & Brands ──')
  let contractsCreated = 0, itemsCreated = 0
  const brandRecords = {}   // key = `${code}|||${brandName}` → prevent duplicates

  for (const [idx, row] of revRows.entries()) {
    const code       = row['Account_code']?.toString().trim()
    const revName    = (row['Account_Name'] || '').toString().trim()
    const account    = accountByCode[code]

    if (!account) {
      console.warn(`   ⚠️  Row ${idx + 1}: no account for code "${code}" (${revName}) — skipping`)
      continue
    }

    // ── Dates ────────────────────────────────────────────────────────────────
    const startDate = excelDateToJS(row['Start_date'])
    if (!startDate) { console.warn(`   ⚠️  Row ${idx + 1}: invalid Start_date for "${revName}" — skipping`); continue }

    // Use Contract_Period=120 override for Simond's and Arigato (code 90, period=120)
    let endDate
    if (row['Contract_Period'] === 120) {
      endDate = addMonths(startDate, 120)
      console.log(`   ℹ️  ${revName}: using 120-month override → end ${endDate.toISOString().slice(0,10)}`)
    } else {
      endDate = excelDateToJS(row['End_date'])
      if (!endDate) { console.warn(`   ⚠️  Row ${idx + 1}: invalid End_date for "${revName}" — skipping`); continue }
    }

    // ── Cancellation ─────────────────────────────────────────────────────────
    let cancellationDate = null
    if ((row['Churn_flag'] || '').toString().trim() === 'Churned') {
      cancellationDate = excelDateToJS(row['Cancellation_Date'])
    }

    // ── Contract Type ─────────────────────────────────────────────────────────
    const typeRaw = (row['New_Expansion_Renewal'] || '').toString().trim()
    const type    = CONTRACT_TYPE_MAP[typeRaw]
    if (!type) { console.warn(`   ⚠️  Row ${idx + 1}: unknown contract type "${typeRaw}" for "${revName}" — defaulting to New`) }

    // ── Contract Value ────────────────────────────────────────────────────────
    const contractValue = typeof row['Contract_Value'] === 'number' ? row['Contract_Value'] : 0

    // ── Collect Brand Names (always, even in dry run) ────────────────────────
    const parentName = parentNameByCode[code] || ''
    if (parentName && revName.toLowerCase() !== parentName.toLowerCase()) {
      const brandKey = `${code}|||${revName.toLowerCase()}`
      if (!brandRecords[brandKey]) {
        brandRecords[brandKey] = { accountId: account.id, name: revName }
      }
    }

    if (DRY_RUN) {
      const isBrand = parentName && revName.toLowerCase() !== parentName.toLowerCase()
      console.log(`   [DRY] Contract: "${revName}" (code=${code}) | type=${type || 'New'} | ${startDate.toISOString().slice(0,10)} → ${endDate.toISOString().slice(0,10)} | value=$${contractValue.toFixed(2)} | churn=${row['Churn_flag']}${isBrand ? ` | brand="${revName}"` : ''}`)
      contractsCreated++
      continue
    }

    // ── Create Contract ───────────────────────────────────────────────────────
    const contract = await prisma.contract.create({
      data: {
        accountId:        account.id,
        contractValue:    contractValue,
        startDate,
        endDate,
        type:             type || 'New',
        cancellationDate,
        usdRate:          1.0,
      }
    })
    contractsCreated++

    // ── Create Synthetic ContractItem ────────────────────────────────────────
    await prisma.contractItem.create({
      data: {
        contractId:  contract.id,
        description: revName,
        quantity:    1,
        unitPrice:   contractValue,
        paymentPlan: 'Yearly',
        lineTotal:   contractValue,
      }
    })
    itemsCreated++
  }

  // ── STEP 3 — Write Brand Records ────────────────────────────────────────────
  console.log('\n── Step 3: Brand Names ──')
  const uniqueBrands = Object.values(brandRecords)

  if (DRY_RUN) {
    console.log(`   [DRY] Would create ${uniqueBrands.length} brand records:`)
    uniqueBrands.forEach(b => console.log(`     → accountId=${b.accountId} name="${b.name}"`))
  } else {
    for (const b of uniqueBrands) {
      await prisma.accountBrand.create({ data: { accountId: b.accountId, name: b.name } })
    }
    console.log(`   ✓  Brands created: ${uniqueBrands.length}`)
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50))
  if (DRY_RUN) {
    console.log('🔍  DRY RUN complete — no data was written.\n')
    console.log(`   Accounts   — ${accCreated} would be created`)
    console.log(`   Contracts  — ${contractsCreated} would be created`)
    console.log(`   Brands     — ${uniqueBrands.length} would be created`)
  } else {
    console.log('✅  Import complete.\n')
    console.log(`   Accounts   — ${accCreated} created`)
    console.log(`   Contracts  — ${contractsCreated} created`)
    console.log(`   Items      — ${itemsCreated} created`)
    console.log(`   Brands     — ${uniqueBrands.length} created`)
  }
  console.log('')
}

main()
  .catch((e) => { console.error('\n❌ Error:', e.message, e); process.exit(1) })
  .finally(() => prisma.$disconnect())
