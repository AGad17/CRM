/**
 * migrate-countries.js
 * Seeds the countries table and migrates Account + ProductPricing from
 * the old Country enum to the new countryId FK.
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

  // Upsert all countries
  for (const c of COUNTRIES) {
    await prisma.countryConfig.upsert({
      where: { code: c.code },
      update: { name: c.name, currency: c.currency },
      create: c,
    })
  }
  console.log(`✓ ${COUNTRIES.length} countries seeded`)

  // Build code → id map
  const rows = await prisma.countryConfig.findMany()
  const codeToId = Object.fromEntries(rows.map((r) => [r.code, r.id]))

  // Migrate accounts
  const accounts = await prisma.account.findMany()
  let aUpdated = 0
  for (const acc of accounts) {
    const id = codeToId[acc.country]
    if (id) {
      await prisma.account.update({ where: { id: acc.id }, data: { countryId: id } })
      aUpdated++
    } else {
      console.warn(`⚠ Account ${acc.id} has unknown country: ${acc.country}`)
    }
  }
  console.log(`✓ ${aUpdated}/${accounts.length} accounts migrated`)

  // Migrate product pricing
  const pricing = await prisma.productPricing.findMany()
  let pUpdated = 0
  for (const p of pricing) {
    const id = codeToId[p.country]
    if (id) {
      await prisma.productPricing.update({ where: { id: p.id }, data: { countryId: id } })
      pUpdated++
    } else {
      console.warn(`⚠ ProductPricing ${p.id} has unknown country: ${p.country}`)
    }
  }
  console.log(`✓ ${pUpdated}/${pricing.length} product pricing rows migrated`)

  console.log('✅ Migration complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
