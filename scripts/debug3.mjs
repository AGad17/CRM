import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const XLSX = require(__dirname + '/../node_modules/xlsx/xlsx.js')

const wb = XLSX.readFile('/Users/ahmedgad/Downloads/Deals Insights.xlsx')
const ws = wb.Sheets['Revenue_Data']
const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
const valid = rows.filter(r => r.Account_code != null && r.Country != null && r.Start_date != null)

function excelToISO(serial) {
  if (!serial || typeof serial !== 'number') return null
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().split('T')[0]
}

// Check churn data
const churned = valid.filter(r => r.Churn_flag === 'Churned')
console.log('Churned contracts:', churned.length)
churned.slice(0, 5).forEach(r => {
  console.log(`Account ${r.Account_code}: endDate=${excelToISO(r.End_date)} cancellationDate=${excelToISO(r.Cancellation_Date)} status=${r.Contract_Status}`)
})

// Check active contracts
const active = valid.filter(r => r.Contract_Status === 'Active')
console.log('\nActive contracts:', active.length)
active.slice(0, 5).forEach(r => {
  console.log(`Account ${r.Account_code}: ${r.Account_Name}, type=${r.New_Expansion_Renewal}, MRR=${r.MRR?.toFixed(2)}, startDate=${excelToISO(r.Start_date)} endDate=${excelToISO(r.End_date)}`)
})
