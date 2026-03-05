import { prisma } from '@/lib/prisma'

const PRICING_INCLUDE = {
  country: { select: { id: true, code: true, currency: true } },
}

export async function getProducts() {
  const [products, countries] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: { pricing: { include: PRICING_INCLUDE, orderBy: { effectiveFrom: 'desc' } } },
    }),
    prisma.country.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }),
  ])
  return products.map((p) => enrichProduct(p, countries))
}

export async function getProductById(id) {
  const [product, countries] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { pricing: { include: PRICING_INCLUDE, orderBy: { effectiveFrom: 'desc' } } },
    }),
    prisma.country.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }),
  ])
  if (!product) return null
  return enrichProduct(product, countries)
}

export async function createProduct(data) {
  const [product, countries] = await Promise.all([
    prisma.product.create({
      data: {
        name: data.name,
        description: data.description || null,
        category: data.category,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      include: { pricing: { include: PRICING_INCLUDE } },
    }),
    prisma.country.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }),
  ])
  return enrichProduct(product, countries)
}

export async function updateProduct(id, data) {
  const [product, countries] = await Promise.all([
    prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { pricing: { include: PRICING_INCLUDE, orderBy: { effectiveFrom: 'desc' } } },
    }),
    prisma.country.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }),
  ])
  return enrichProduct(product, countries)
}

export async function addPricing(productId, data) {
  const country = await prisma.country.findUnique({ where: { code: data.country } })
  if (!country) throw new Error(`Country not found: ${data.country}`)

  return prisma.productPricing.create({
    data: {
      productId,
      countryId: country.id,
      price: data.price,
      currency: country.currency,
      effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
      notes: data.notes || null,
    },
  })
}

export async function updatePricing(pricingId, data) {
  return prisma.productPricing.update({
    where: { id: pricingId },
    data: {
      ...(data.price !== undefined && { price: data.price }),
      ...(data.effectiveFrom !== undefined && { effectiveFrom: new Date(data.effectiveFrom) }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  })
}

export async function deletePricing(pricingId) {
  return prisma.productPricing.delete({ where: { id: pricingId } })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enrichProduct(product, countries) {
  const currentPricing = {}
  const historyByCountry = {}

  for (const country of countries) {
    const entries = product.pricing.filter((p) => p.country?.code === country.code)
    historyByCountry[country.code] = entries
    currentPricing[country.code] = entries.length > 0 ? entries[0] : null
  }

  return { ...product, currentPricing, historyByCountry }
}
