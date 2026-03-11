import { NextResponse } from 'next/server'
// Removed — use /api/invoicing/pricing/addon instead
export async function GET()  { return NextResponse.json({ error: 'Removed. Use /api/invoicing/pricing/addon' }, { status: 410 }) }
export async function POST() { return NextResponse.json({ error: 'Removed. Use /api/invoicing/pricing/addon' }, { status: 410 }) }
