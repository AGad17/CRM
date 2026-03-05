/**
 * seed-from-excel.js
 * Wipes existing accounts/contracts and loads data from "Deals Insights.xlsx"
 */
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const XLSX = require(__dirname + '/../node_modules/xlsx/xlsx.js')

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// ─── Constants ────────────────────────────────────────────────────────────────

const EXCEL_PATH = '/Users/ahmedgad/Downloads/Deals Insights.xlsx'

const LEAD_SOURCE_MAP = {
  'Employee Referral':   'EmployeeReferral',
  'Direct Sales':        'DirectSales',
  'Ambassador Referral': 'AmbassadorReferral',
  'Customer Referral':   'CustomerReferral',
  'Partner Referral':    'PartnerReferral',
  'Website':             'Website',
  'Foodics':             'Foodics',
  'Sonic':               'Sonic',
}

const COUNTRY_CODE_MAP = {
  KSA:     'KSA',
  Egypt:   'Egypt',
  UAE:     'UAE',
  Bahrain: 'Bahrain',
  Jordan:  'Jordan',
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function excelToISO(serial) {
  if (!serial || typeof serial !== 'number') return null
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().split('T')[0]
}


// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📂 Loading Excel file…')
  const wb = XLSX.readFile(EXCEL_PATH)
  const accountRows = XLSX.utils.sheet_to_json(wb.Sheets['Accounts_Data'], { defval: null })
  const allContractRows = XLSX.utils.sheet_to_json(wb.Sheets['Revenue_Data'], { defval: null })
  const contractRows = allContractRows.filter(
    r => r.Account_code != null && r.Country != null && r.Start_date != null
  )

  console.log(`📊 Found ${accountRows.length} accounts, ${contractRows.length} valid contracts`)

  // ── 1. Delete existing data ─────────────────────────────────────────────────
  console.log('\n🗑️  Deleting existing data…')
  const deletedItems = await prisma.contractItem.deleteMany()
  const deletedContracts = await prisma.contract.deleteMany()
  const deletedAccounts = await prisma.account.deleteMany()
  console.log(`   Deleted ${deletedItems.count} contract items, ${deletedContracts.count} contracts, ${deletedAccounts.count} accounts`)

  // ── 2. Load countries ───────────────────────────────────────────────────────
  const countries = await prisma.country.findMany()
  const countryIdMap = {} // code → id
  countries.forEach(c => { countryIdMap[c.code] = c.id })
  console.log(`\n🌍 Loaded ${countries.length} countries: ${countries.map(c => c.code).join(', ')}`)

  // ── 3. Create accounts ──────────────────────────────────────────────────────
  console.log('\n🏢 Creating accounts…')
  const accountCodeToId = {} // Excel code → DB id
  let accountsCreated = 0, accountsSkipped = 0

  for (const row of accountRows) {
    const code = COUNTRY_CODE_MAP[row.Country]
    if (!code || !countryIdMap[code]) { accountsSkipped++; continue }
    const leadSource = LEAD_SOURCE_MAP[row['Lead Source']] || 'DirectSales'

    const account = await prisma.account.create({
      data: {
        name:               row['Account Name'],
        leadSource,
        countryId:          countryIdMap[code],
        brands:             row.Brands || 1,
        numberOfBranches:   row['Number of Branches'] || 1,
        numberOfCostCentres: row['Number of Cost centres'] || null,
      },
    })
    accountCodeToId[row['Account Code']] = account.id
    accountsCreated++
  }
  console.log(`   ✅ Created ${accountsCreated} accounts (skipped ${accountsSkipped})`)

  // ── 4. Create contracts ─────────────────────────────────────────────────────
  console.log('\n📄 Creating contracts…')
  let contractsCreated = 0, contractsSkipped = 0

  for (const row of contractRows) {
    const accountId = accountCodeToId[row.Account_code]
    if (!accountId) { contractsSkipped++; continue }

    const code = COUNTRY_CODE_MAP[row.Country]
    if (!code) { contractsSkipped++; continue }

    const startDate = excelToISO(row.Start_date)
    const endDate   = excelToISO(row.End_date)
    if (!startDate || !endDate) { contractsSkipped++; continue }

    const cancellationDate = (row.Churn_flag === 'Churned' && row.Cancellation_Date)
      ? excelToISO(row.Cancellation_Date)
      : null

    const contractType = ['New', 'Renewal', 'Expansion'].includes(row.New_Expansion_Renewal)
      ? row.New_Expansion_Renewal
      : 'New'

    await prisma.contract.create({
      data: {
        accountId,
        contractValue:   row.Contract_Value || 0,
        startDate:       new Date(startDate),
        endDate:         new Date(endDate),
        type:            contractType,
        cancellationDate: cancellationDate ? new Date(cancellationDate) : null,
        usdRate: 1, // values already in USD
      },
    })
    contractsCreated++
    if (contractsCreated % 20 === 0) process.stdout.write(`   ${contractsCreated} contracts…\r`)
  }
  console.log(`   ✅ Created ${contractsCreated} contracts (skipped ${contractsSkipped})`)

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n🎉 Done!')
  console.log(`   Accounts: ${accountsCreated}`)
  console.log(`   Contracts: ${contractsCreated}`)
}

main()
  .catch(e => { console.error('\n❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
