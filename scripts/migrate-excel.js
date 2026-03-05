/**
 * ShopBrain CRM — Excel Migration Script
 * Usage: node scripts/migrate-excel.js /path/to/Deals_Insights.xlsx
 *
 * Reads Revenue_Data and Accounts_Data sheets and imports into the DB.
 */

import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import { differenceInMonths } from 'date-fns'

const prisma = new PrismaClient()

const LEAD_SOURCE_MAP = {
  'Foodics': 'Foodics',
  'Employee Referral': 'EmployeeReferral',
  'Customer Referral': 'CustomerReferral',
  'Partner Referral': 'PartnerReferral',
  'Website': 'Website',
  'Ambassador Referral': 'AmbassadorReferral',
  'Direct Sales': 'DirectSales',
  'Sonic': 'Sonic',
}

const COUNTRY_MAP = {
  'KSA': 'KSA', 'Saudi Arabia': 'KSA', 'SA': 'KSA',
  'Egypt': 'Egypt', 'EGY': 'Egypt', 'EG': 'Egypt',
  'UAE': 'UAE', 'United Arab Emirates': 'UAE',
  'Bahrain': 'Bahrain', 'BH': 'Bahrain',
  'Jordan': 'Jordan', 'JO': 'Jordan',
}

const TYPE_MAP = {
  'New': 'New', 'new': 'New',
  'Renewal': 'Renewal', 'renewal': 'Renewal',
  'Expansion': 'Expansion', 'expansion': 'Expansion',
}

function parseDate(val) {
  if (!val) return null
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val)
    return new Date(d.y, d.m - 1, d.d)
  }
  const d = new Date(val)
  return isNaN(d) ? null : d
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: node scripts/migrate-excel.js /path/to/file.xlsx')
    process.exit(1)
  }

  console.log(`\n📂 Reading: ${filePath}`)
  const wb = XLSX.readFile(filePath)

  const sheetNames = wb.SheetNames
  console.log(`📋 Sheets found: ${sheetNames.join(', ')}`)

  // ─── Accounts ───────────────────────────────────────────────────────────────
  const accountSheet = wb.Sheets['Accounts_Data'] || wb.Sheets[sheetNames.find((s) => s.toLowerCase().includes('account'))]
  let imported = 0, warnings = 0, skipped = 0
  const accountIdMap = {} // Excel account name → DB id

  if (accountSheet) {
    const rows = XLSX.utils.sheet_to_json(accountSheet, { defval: null })
    console.log(`\n🏢 Importing ${rows.length} accounts…`)

    for (const row of rows) {
      const name = row['Account Name'] || row['account_name'] || row['Name']
      const leadSource = LEAD_SOURCE_MAP[row['Lead Source'] || row['lead_source']]
      const country = COUNTRY_MAP[row['Country'] || row['country']]

      if (!name || !leadSource || !country) {
        console.warn(`  ⚠ Skipping account row — missing required fields:`, { name, leadSource, country })
        skipped++
        continue
      }

      try {
        const acc = await prisma.account.create({
          data: {
            name: String(name),
            leadSource,
            country,
            brands: Number(row['Brands'] || row['brands'] || 1),
            numberOfBranches: Number(row['Number of Branches'] || row['number_of_branches'] || 1),
            numberOfCostCentres: row['Number of Cost Centres'] ? Number(row['Number of Cost Centres']) : null,
          },
        })
        accountIdMap[String(name)] = acc.id
        imported++
      } catch (err) {
        console.warn(`  ⚠ Account "${name}": ${err.message}`)
        warnings++
      }
    }
    console.log(`  ✅ ${imported} imported, ⚠ ${warnings} warnings, ✗ ${skipped} skipped`)
  }

  // ─── Contracts ──────────────────────────────────────────────────────────────
  const revenueSheet = wb.Sheets['Revenue_Data'] || wb.Sheets[sheetNames.find((s) => s.toLowerCase().includes('revenue') || s.toLowerCase().includes('contract'))]
  let cImported = 0, cWarnings = 0, cSkipped = 0

  if (revenueSheet) {
    const rows = XLSX.utils.sheet_to_json(revenueSheet, { defval: null })
    console.log(`\n📄 Importing ${rows.length} contracts…`)

    for (const row of rows) {
      const accountName = String(row['Account Name'] || row['account_name'] || '')
      const accountId = accountIdMap[accountName]

      if (!accountId) {
        console.warn(`  ⚠ Contract skipped — account not found: "${accountName}"`)
        cSkipped++
        continue
      }

      const startDate = parseDate(row['Start Date'] || row['start_date'])
      const endDate = parseDate(row['End Date'] || row['end_date'])
      const contractValue = Number(row['Contract Value'] || row['contract_value'] || 0)
      const type = TYPE_MAP[row['Type'] || row['type']] || 'New'
      const cancellationDate = parseDate(row['Cancellation Date'] || row['cancellation_date'])

      if (!startDate || !endDate) {
        console.warn(`  ⚠ Contract for "${accountName}" — invalid dates`)
        cWarnings++; continue
      }

      if (endDate < startDate) {
        console.warn(`  ⚠ Contract for "${accountName}" — endDate < startDate`)
        cWarnings++; continue
      }

      if (contractValue <= 0) {
        console.warn(`  ⚠ Contract for "${accountName}" — contractValue <= 0`)
        cWarnings++; continue
      }

      // Validate MRR
      const period = Math.max(1, differenceInMonths(endDate, startDate))
      const computedMRR = contractValue / period
      const excelMRR = Number(row['MRR'] || row['mrr'] || 0)
      if (excelMRR && Math.abs(computedMRR - excelMRR) > 1) {
        console.warn(`  ⚠ MRR mismatch for "${accountName}": computed ${computedMRR.toFixed(2)} vs excel ${excelMRR.toFixed(2)}`)
      }

      try {
        await prisma.contract.create({
          data: {
            accountId,
            contractValue,
            startDate,
            endDate,
            type,
            cancellationDate,
          },
        })
        cImported++
      } catch (err) {
        console.warn(`  ⚠ Contract for "${accountName}": ${err.message}`)
        cWarnings++
      }
    }
    console.log(`  ✅ ${cImported} imported, ⚠ ${cWarnings} warnings, ✗ ${cSkipped} skipped`)
  }

  console.log(`\n🎉 Migration complete!`)
  console.log(`   Accounts: ${imported} imported`)
  console.log(`   Contracts: ${cImported} imported`)
  console.log(`\n   Run the app and verify the CCO Dashboard matches your Excel dashboard.`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
