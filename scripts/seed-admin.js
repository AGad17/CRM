import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = process.argv[2] || 'admin@shopbrain.com'
  const password = process.argv[3] || 'Admin@123'
  const name = process.argv[4] || 'Admin'

  const hashed = await bcrypt.hash(password, 12)

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, role: 'CCO_ADMIN', name },
    create: { email, password: hashed, role: 'CCO_ADMIN', name },
  })

  console.log(`\n✅ Admin user ready:`)
  console.log(`   Email:    ${user.email}`)
  console.log(`   Password: ${password}`)
  console.log(`   Role:     ${user.role}`)
  console.log(`\n👉 Go to http://localhost:3000/login and sign in.\n`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
