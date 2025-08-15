import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// Helper to decide if JWT is still valid
function isTokenValid(token: any) {
  if (!token) return false
  if (!token.exp) return true
  return token.exp * 1000 > Date.now()
}

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const isAuth = isTokenValid(token)
  const isLogin = req.nextUrl.pathname === "/login"

  if (!isAuth && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (isAuth && isLogin) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
