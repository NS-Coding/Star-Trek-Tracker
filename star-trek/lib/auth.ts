import { getServerSession, type NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { query } from "@/lib/db"

/**
 * Next-Auth configuration bound to our Prisma schema.
 * We use JWT sessions so that we don’t need the Session table.
 */
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) return null

        // Lookup user by username
        const { rows } = await query<{ id: string; username: string; email: string; password: string; is_admin: boolean; is_approved: boolean }>(
          `SELECT id, username, email, password, is_admin, is_approved FROM users WHERE username = $1`,
          [credentials.username]
        )
        const user = rows[0]
        if (!user || !user.is_approved) return null

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) return null

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          isAdmin: user.is_admin,
        } as any
      },
    }),
  ],
  callbacks: {
    // Embed user fields we care about inside the JWT
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.username = (user as any).username
        token.email = (user as any).email
        token.isAdmin = (user as any).isAdmin
      }
      return token
    },
    // And surface them to the client Session object
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string
        session.user.username = token.username as string
        session.user.email = token.email as string
        session.user.isAdmin = token.isAdmin as boolean
      }
      return session
    },
  },
}

export function getAuthSession() {
  return getServerSession(authOptions)
}