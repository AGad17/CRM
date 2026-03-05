/**
 * migrate-countries.js
 * Seeds the countries table with default countries.
 * Safe to run on a fresh DB or re-run (uses upsert).
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const COUNTRIES = [
  { code: 'KSA',     name: 'Saudi Arabia', currency: 'SAR' },
  { code: 'Egypt',   name: 'Egypt',        currency: 'EGP' },
  { code: 'UAE',     name: 'UAE',          currency: 'AED' },
  { code: 'Bahrain', name: 'Bahrain',      currency: 'BHD' },
  { code: 'Jordan',  name: 'Jordan',       currency: 'JOD' },
]

async function main() {
  console.log('🌍 Seeding countries table...')

  for (const c of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name, currency: c.currency },
      create: c,
    })
    console.log(`  ✓ ${c.name} (${c.code} / ${c.currency})`)
  }

  console.log(`\n✅ ${COUNTRIES.length} countries seeded successfully!`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
