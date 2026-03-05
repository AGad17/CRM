import { prisma } from './prisma'

/**
 * Fetch the USD exchange rate for a given currency on a given date.
 * Rate is stored as: 1 USD = X local currency.
 * To convert local → USD: localValue / rate
 *
 * Uses free historical API: https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{date}/v1/currencies/usd.min.json
 * Falls back to latest rates if the historical date is unavailable.
 */
export async function getUSDRate(currency, date) {
  if (!currency) return null

  const currencyLower = currency.toLowerCase()
  const dateObj = date ? new Date(date) : new Date()
  const dateStr = dateObj.toISOString().split('T')[0] // YYYY-MM-DD

  // Check DB cache first
  const cached = await prisma.exchangeRate.findUnique({
    where: { date_currency: { date: new Date(dateStr), currency: currency.toUpperCase() } },
  })
  if (cached) return Number(cached.rateToUSD)

  // Fetch from API
  const rate = await fetchRate(currencyLower, dateStr)
  if (!rate) return null

  // Cache in DB
  try {
    await prisma.exchangeRate.create({
      data: {
        date: new Date(dateStr),
        currency: currency.toUpperCase(),
        rateToUSD: rate,
      },
    })
  } catch {
    // Ignore unique constraint violations (race condition)
  }

  return rate
}

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
    } catch {
      // try next URL
    }
  }

  // Hardcoded fallback rates (approximate) so the app doesn't break
  const FALLBACK = { SAR: 3.75, EGP: 50.0, AED: 3.67, BHD: 0.376, JOD: 0.709, KWD: 0.307 }
  return FALLBACK[currencyLower.toUpperCase()] ?? null
}
