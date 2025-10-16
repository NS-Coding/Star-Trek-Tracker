import { NextResponse } from "next/server"

import prisma from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const { username } = await req.json()
    if (!username) {
      return NextResponse.json({ error: "Missing username" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { username } })

    if (!user) {
      // Do not reveal too much info; indicate not found generically
      return NextResponse.json({ exists: false }, { status: 200 })
    }

    return NextResponse.json({ exists: true, isApproved: user.isApproved })
  } catch (e) {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
