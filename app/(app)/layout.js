import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'

export default async function AppLayout({ children }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return <AppShell>{children}</AppShell>
}
