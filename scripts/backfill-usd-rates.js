/**
 * backfill-usd-rates.js
 * Fetches and stores the historical USD rate for every existing contract
 * that doesn't yet have a usdRate set.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const FALLBACK = { SAR: 3.75, EGP: 50.0, AED: 3.67, BHD: 0.376, JOD: 0.709, KWD: 0.307 }

async function fetchRate(currencyLower, dateStr) {
  const urls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/usd.min.json`,
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) continue
      const data = await res.json()
      const rate = data?.usd?.[currencyLower]
      if (rate && Number(rate) > 0) return Number(rate)
    } catch { /* try next */ }
  }
  return FALLBACK[currencyLower.toUpperCase()] ?? null
}

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { usdRate: null },
    include: { account: { include: { country: { select: { currency: true } } } } },
  })

  console.log(`Found ${contracts.length} contracts without USD rate`)

  let updated = 0
  for (const c of contracts) {
    const currency = c.account?.country?.currency
    if (!currency) { console.warn(`Contract ${c.id}: no currency, skipping`); continue }

    const dateStr = new Date(c.startDate).toISOString().split('T')[0]
    const rate = await fetchRate(currency.toLowerCase(), dateStr)

    if (rate) {
      await prisma.contract.update({ where: { id: c.id }, data: { usdRate: rate } })

      // Cache in exchange_rates
      try {
        await prisma.exchangeRate.create({
          data: { date: new Date(dateStr), currency: currency.toUpperCase(), rateToUSD: rate },
        })
      } catch { /* already cached */ }

      console.log(`Contract ${c.id} (${currency}, ${dateStr}): rate = ${rate}`)
      updated++
    } else {
      console.warn(`Contract ${c.id}: could not fetch rate for ${currency}`)
    }
  }

  console.log(`\n✅ Updated ${updated}/${contracts.length} contracts`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
