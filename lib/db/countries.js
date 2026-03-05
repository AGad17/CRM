import { prisma } from '@/lib/prisma'

export async function getCountries(includeInactive = false) {
  return prisma.country.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: 'asc' },
    include: { _count: { select: { accounts: true } } },
  })
}

export async function getCountryById(id) {
  return prisma.country.findUnique({
    where: { id },
    include: { _count: { select: { accounts: true } } },
  })
}

export async function createCountry(data) {
  return prisma.country.create({
    data: {
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      currency: data.currency.trim().toUpperCase(),
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
  })
}

export async function updateCountry(id, data) {
  return prisma.country.update({
    where: { id },
    data: {
      ...(data.code !== undefined && { code: data.code.trim().toUpperCase() }),
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.currency !== undefined && { currency: data.currency.trim().toUpperCase() }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  })
}

export async function deleteCountry(id) {
  // Check if any accounts reference this country
  const count = await prisma.account.count({ where: { countryId: id } })
  if (count > 0) {
    throw new Error(`Cannot delete country: ${count} account(s) are assigned to it.`)
  }
  return prisma.country.delete({ where: { id } })
}
