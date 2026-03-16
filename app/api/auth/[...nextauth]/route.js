// next-auth v4 ships as CJS; the interop fix lives in lib/auth.js
// Import the already-constructed handler from there instead of calling NextAuth() again.
import handler from '@/lib/auth'

export { handler as GET, handler as POST }
