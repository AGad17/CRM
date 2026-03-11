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
console.log('Valid rows:', valid.length)
console.log('Last valid row:', JSON.stringify(valid[valid.length - 1]).substring(0, 200))

// Check unique accounts among valid rows
const accounts = new Set(valid.map(r => r.Account_code))
console.log('Unique account codes:', accounts.size)

// Country distribution
const byCountry = {}
valid.forEach(r => { byCountry[r.Country] = (byCountry[r.Country] || 0) + 1 })
console.log('By country:', byCountry)

// Contract type distribution
const byType = {}
valid.forEach(r => { byType[r.New_Expansion_Renewal] = (byType[r.New_Expansion_Renewal] || 0) + 1 })
console.log('By type:', byType)

// Date range
function excelToISO(serial) {
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().split('T')[0]
}
const dates = valid.map(r => excelToISO(r.Start_date)).sort()
console.log('Date range:', dates[0], '->', dates[dates.length - 1])
