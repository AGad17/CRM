import _NextAuth from 'next-auth'
import _CredentialsProvider from 'next-auth/providers/credentials'
// next-auth v4 ships as CJS; handle ESM interop for both default exports
const NextAuth = _NextAuth.default ?? _NextAuth
const CredentialsProvider = _CredentialsProvider.default ?? _CredentialsProvider
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
            include: { customRole: { select: { id: true, name: true, permissions: true } } },
          })

          console.log('[auth] lookup:', credentials.email, '→', user ? 'found' : 'not found')

          if (!user || !user.password) return null

          const bcrypt = await import('bcryptjs')
          const valid = await bcrypt.compare(credentials.password, user.password)
          console.log('[auth] password valid:', valid)
          if (!valid) return null

          return {
            id:                   user.id,
            name:                 user.name,
            email:                user.email,
            role:                 user.role,
            permissions:          user.permissions ?? {},  // per-module overrides
            customRoleId:         user.customRole?.id ?? null,
            customRoleName:       user.customRole?.name ?? null,
            customRolePermissions: user.customRole?.permissions ?? null,
          }
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
      if (user) {
        token.role                  = user.role
        token.id                    = user.id
        token.permissions           = user.permissions ?? {}
        token.customRoleId          = user.customRoleId ?? null
        token.customRoleName        = user.customRoleName ?? null
        token.customRolePermissions = user.customRolePermissions ?? null
      } else {
        // Re-fetch mutable fields on every subsequent request so admin role
        // assignments take effect immediately without requiring a re-login.
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: token.id ?? token.sub },
            select: {
              permissions: true,
              customRole: { select: { id: true, name: true, permissions: true } },
            },
          })
          if (fresh) {
            token.permissions           = fresh.permissions ?? {}
            token.customRoleId          = fresh.customRole?.id ?? null
            token.customRoleName        = fresh.customRole?.name ?? null
            token.customRolePermissions = fresh.customRole?.permissions ?? null
          }
        } catch {
          // Keep cached values on DB error — user continues with last-known perms
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.role                 = token.role
        session.user.id                   = token.id ?? token.sub
        session.user.permissions          = token.permissions ?? {}
        session.user.customRoleId         = token.customRoleId ?? null
        session.user.customRoleName       = token.customRoleName ?? null
        session.user.customRolePermissions = token.customRolePermissions ?? null
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

export default NextAuth(authOptions)
