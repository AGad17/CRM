import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const XLSX = require(__dirname + '/../node_modules/xlsx/xlsx.js')

const wb = XLSX.readFile('/Users/ahmedgad/Downloads/Deals Insights.xlsx')
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Revenue_Data'])

const COUNTRY_CURRENCY = { KSA: 'SAR', Egypt: 'EGP', UAE: 'AED', Bahrain: 'BHD', Jordan: 'JOD' }

function excelToISO(serial) {
  if (!serial || typeof serial !== 'number') return null
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().split('T')[0]
}

const pairs = new Set()
let skipped = 0
rows.forEach(r => {
  if (!r.Account_code || !r.Country || !r.Start_date) { skipped++; return }
  const currency = COUNTRY_CURRENCY[r.Country]
  const date = excelToISO(r.Start_date)
  if (currency && date) pairs.add(currency + '|' + date)
})
const sorted = [...pairs].sort()
console.log('Unique currency+date pairs:', sorted.length)
console.log('Skipped rows:', skipped)
console.log('Date range:', sorted[0], '->', sorted[sorted.length - 1])
