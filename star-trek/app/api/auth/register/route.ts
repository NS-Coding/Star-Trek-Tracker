import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

import prisma from "@/lib/prisma"

export async function POST(req: Request) {
  const { username, email, password } = await req.json()

  if (!username || !email || !password)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
  })
  if (existing)
    return NextResponse.json({ error: "User already exists" }, { status: 409 })

  const totalUsers = await prisma.user.count()
  const isFirstUser = totalUsers === 0

  const hashed = await bcrypt.hash(password, 10)
  await prisma.user.create({
    data: {
      username,
      email,
      password: hashed,
      isAdmin: isFirstUser,
      isApproved: isFirstUser, // auto-approve first user
    },
  })

  return NextResponse.json({ success: true, requiresApproval: !isFirstUser })
}