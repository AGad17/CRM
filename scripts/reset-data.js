/**
 * reset-data.js
 *
 * Deletes all operational data (accounts, contracts, leads, deals, invoices,
 * onboarding records, activity logs, health snapshots, notes).
 *
 * Does NOT touch: users, countries, products, product_pricing,
 *                 exchange_rates, inventory_pricing, addon_pricing
 *
 * Usage:
 *   node scripts/reset-data.js
 *   node scripts/reset-data.js --confirm   ← skip interactive prompt
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import readline from 'readline'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function confirm() {
  if (process.argv.includes('--confirm')) return true
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(
      '\n⚠️  This will permanently delete ALL accounts, contracts, leads, deals,\n' +
      '   invoices, onboarding records, and activity logs.\n' +
      '   Users, countries, and product catalog will be kept.\n\n' +
      '   Type YES to continue: ',
      (answer) => { rl.close(); resolve(answer.trim() === 'YES') }
    )
  })
}

async function main() {
  const ok = await confirm()
  if (!ok) { console.log('\nAborted — nothing was deleted.\n'); return }

  console.log('\n🗑️  Resetting data...\n')

  // Run deletes sequentially (respects FK order, avoids transaction timeouts)
  const steps = [
    // ── Derived / child tables first ──────────────────────────────────────
    ['Activity logs',       () => prisma.activityLog.deleteMany()],
    ['Health snapshots',    () => prisma.accountHealthSnapshot.deleteMany()],
    ['Account brands',      () => prisma.accountBrand.deleteMany()],
    ['Account notes',       () => prisma.accountNote.deleteMany()],
    ['Handover docs',       () => prisma.handoverDocument.deleteMany()],
    ['Invoices',            () => prisma.invoice.deleteMany()],
    // Onboarding children cascade from tracker, but explicit is safer
    ['NPS records',         () => prisma.npsRecord.deleteMany()],
    ['CSAT records',        () => prisma.csatRecord.deleteMany()],
    ['Onboarding notes',    () => prisma.onboardingNote.deleteMany()],
    ['Onboarding tasks',    () => prisma.onboardingTask.deleteMany()],
    ['Onboarding trackers', () => prisma.onboardingTracker.deleteMany()],
    // ── Mid-level ─────────────────────────────────────────────────────────
    ['Leads',               () => prisma.lead.deleteMany()],
    ['Deals',               () => prisma.deal.deleteMany()],
    // ── Contracts ─────────────────────────────────────────────────────────
    ['Contract items',      () => prisma.contractItem.deleteMany()],
    ['Contracts',           () => prisma.contract.deleteMany()],
    // ── Root ──────────────────────────────────────────────────────────────
    ['Accounts',            () => prisma.account.deleteMany()],
  ]

  for (const [label, fn] of steps) {
    const { count } = await fn()
    if (count > 0) console.log(`   ✓  ${label.padEnd(22)} — ${count} deleted`)
  }

  console.log('\n✅  Database reset complete. Ready for fresh import.\n')
  console.log('   Next step: fill in the CSV templates in /data-templates/')
  console.log('   then run:  node scripts/import-data.js\n')
}

main()
  .catch((e) => { console.error('\n❌ Error:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
