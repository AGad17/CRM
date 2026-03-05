import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/roleGuard'
import { getAccounts } from '@/lib/db/accounts'
import { getContracts } from '@/lib/db/contracts'

function toCSV(rows, columns) {
  const header = columns.join(',')
  const lines = rows.map((row) =>
    columns.map((col) => {
      const val = row[col]
      if (val === null || val === undefined) return ''
      const str = String(val)
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  )
  return [header, ...lines].join('\n')
}

export async function GET(request) {
  const { error } = await requireAuth('export')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'contracts'

  let csv = ''
  let filename = ''

  if (type === 'accounts') {
    const accounts = await getAccounts()
    const cols = ['id', 'name', 'leadSource', 'country', 'brands', 'numberOfBranches', 'status', 'totalMRR', 'contractCount', 'churnDate', 'createdAt']
    csv = toCSV(accounts, cols)
    filename = 'accounts.csv'
  } else {
    const contracts = await getContracts()
    const flat = contracts.map((c) => ({
      ...c,
      accountName: c.account?.name || '',
      accountCountry: c.account?.country || '',
    }))
    const cols = ['id', 'accountName', 'accountCountry', 'type', 'contractValue', 'startDate', 'endDate', 'mrr', 'arr', 'contractStatus', 'churnFlag', 'cancellationDate', 'startingYear', 'startingQuarterYear', 'startingMonth']
    csv = toCSV(flat, cols)
    filename = 'contracts.csv'
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
