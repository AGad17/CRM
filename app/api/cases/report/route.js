import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/roleGuard'
import { getCases, getCaseStats } from '@/lib/db/engagementCases'

function formatTTR(ms) {
  if (ms == null) return ''
  const hrs = ms / (1000 * 60 * 60)
  if (hrs < 24) return `${Math.round(hrs)}h`
  return `${(hrs / 24).toFixed(1)} days`
}

export async function GET(request) {
  const { error } = await requirePermission('cases', 'view')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const filters = {}
  if (searchParams.get('status'))       filters.status       = searchParams.get('status')
  if (searchParams.get('objective'))    filters.objective    = searchParams.get('objective')
  if (searchParams.get('accountId'))    filters.accountId    = searchParams.get('accountId')
  if (searchParams.get('assignedToId')) filters.assignedToId = searchParams.get('assignedToId')
  if (searchParams.get('from'))         filters.from         = searchParams.get('from')
  if (searchParams.get('to'))           filters.to           = searchParams.get('to')

  const [cases, stats] = await Promise.all([getCases(filters), getCaseStats(filters)])

  if (searchParams.get('format') === 'csv') {
    const rows = [
      ['Case#', 'Title', 'Account', 'Objective', 'Status', 'Assigned To', 'Opened', 'Resolved', 'TTR (hrs)'],
    ]
    for (const c of cases) {
      const ttrMs = c.resolvedAt ? new Date(c.resolvedAt) - new Date(c.openedAt) : null
      const ttrHrs = ttrMs != null ? (ttrMs / (1000 * 60 * 60)).toFixed(1) : ''
      rows.push([
        c.id,
        `"${(c.title || '').replace(/"/g, '""')}"`,
        `"${(c.account?.name || '').replace(/"/g, '""')}"`,
        c.objective,
        c.status,
        `"${((c.assignedTo?.name || c.assignedTo?.email) || 'Unassigned').replace(/"/g, '""')}"`,
        c.openedAt ? new Date(c.openedAt).toLocaleDateString('en-GB') : '',
        c.resolvedAt ? new Date(c.resolvedAt).toLocaleDateString('en-GB') : '',
        ttrHrs,
      ])
    }
    const csv = rows.map(r => r.join(',')).join('\n')
    return new Response(csv, {
      headers: {
        'Content-Type':        'text/csv',
        'Content-Disposition': 'attachment; filename="case-report.csv"',
      },
    })
  }

  return NextResponse.json({ cases, stats })
}
