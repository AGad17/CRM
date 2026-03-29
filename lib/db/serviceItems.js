import { prisma } from '@/lib/prisma'

export async function getServiceItems({ includeInactive = false } = {}) {
  return prisma.serviceItem.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ pricingType: 'asc' }, { name: 'asc' }],
  })
}

export async function createServiceItem(data) {
  return prisma.serviceItem.create({
    data: {
      name:         data.name.trim(),
      description:  data.description?.trim() || null,
      defaultPrice: Number(data.defaultPrice) || 0,
      pricingType:  data.pricingType || 'Custom',
    },
  })
}

export async function updateServiceItem(id, data) {
  return prisma.serviceItem.update({
    where: { id: Number(id) },
    data: {
      name:         data.name?.trim(),
      description:  data.description?.trim() ?? undefined,
      defaultPrice: data.defaultPrice != null ? Number(data.defaultPrice) : undefined,
      pricingType:  data.pricingType  ?? undefined,
      isActive:     data.isActive     ?? undefined,
    },
  })
}

export async function deleteServiceItem(id) {
  // Soft delete — deactivate rather than destroy
  return prisma.serviceItem.update({
    where: { id: Number(id) },
    data:  { isActive: false },
  })
}
