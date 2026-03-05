import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          })

          console.log('[auth] lookup:', credentials.email, '→', user ? 'found' : 'not found')

          if (!user || !user.password) return null

          const bcrypt = await import('bcryptjs')
          const valid = await bcrypt.compare(credentials.password, user.password)
          console.log('[auth] password valid:', valid)
          if (!valid) return null

          return { id: user.id, name: user.name, email: user.email, role: user.role }
        } catch (err) {
          console.error('[auth] error:', err.message)
          return null
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = user.role
      return token
    },
    async session({ session, token }) {
      if (session?.user) session.user.role = token.role
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

export default NextAuth(authOptions)
