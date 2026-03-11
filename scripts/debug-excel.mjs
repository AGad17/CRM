import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const XLSX = require(__dirname + '/../node_modules/xlsx/xlsx.js')

const wb = XLSX.readFile('/Users/ahmedgad/Downloads/Deals Insights.xlsx')
const ws = wb.Sheets['Revenue_Data']

// Try with header:1 to see raw rows
const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
console.log('Total raw rows:', rawRows.length)
console.log('Row 0 (headers):', JSON.stringify(rawRows[0]))
console.log('Row 1:', JSON.stringify(rawRows[1]))
console.log('Row 50:', JSON.stringify(rawRows[50]))

// Now try default (uses first row as headers)
const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
console.log('\nTotal parsed rows:', rows.length)
console.log('First row:', JSON.stringify(rows[0]))
console.log('Row 49:', JSON.stringify(rows[49]))
console.log('\nRows with null Account_code:', rows.filter(r => r.Account_code == null).length)
console.log('Rows with null Country:', rows.filter(r => r.Country == null).length)
console.log('Rows with null Start_date:', rows.filter(r => r.Start_date == null).length)
