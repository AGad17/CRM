import { NextResponse } from 'next/server'

/** Quick env-var health check — safe to call publicly (no secrets exposed). */
export async function GET() {
  return NextResponse.json({
    resendKeySet: !!process.env.RESEND_API_KEY,
    nextauthUrl:  process.env.NEXTAUTH_URL || '(not set)',
    nodeEnv:      process.env.NODE_ENV,
  })
}
