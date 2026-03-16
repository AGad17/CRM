import { prisma } from '../lib/prisma.js'

// 1. Delete all test onboarding trackers + tasks (cascade)
const deleted = await prisma.onboardingTracker.deleteMany({})
console.log(`Deleted ${deleted.count} onboarding trackers (tasks cascade-deleted)`)

// 2. Rename enum values directly in PostgreSQL
//    WelcomeCall → DealClosure,  Active → AccountManagement
await prisma.$executeRaw`ALTER TYPE "OnboardingPhase" RENAME VALUE 'WelcomeCall' TO 'DealClosure'`
console.log('Renamed WelcomeCall → DealClosure')

await prisma.$executeRaw`ALTER TYPE "OnboardingPhase" RENAME VALUE 'Active' TO 'AccountManagement'`
console.log('Renamed Active → AccountManagement')

await prisma.$disconnect()
console.log('Done.')
