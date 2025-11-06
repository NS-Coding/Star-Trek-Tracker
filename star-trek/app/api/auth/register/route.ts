import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST(req: Request) {
  const { username, email, password } = await req.json()

  if (!username || !email || !password)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  // Check for existing user by username or email
  const { rows: existingRows } = await query<{ id: string }>(
    `SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1`,
    [username, email]
  )
  if (existingRows.length > 0)
    return NextResponse.json({ error: "User already exists" }, { status: 409 })

  const { rows: countRows } = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users`)
  const isFirstUser = parseInt(countRows[0].count, 10) === 0

  const hashed = await bcrypt.hash(password, 10)
  await query(
    `INSERT INTO users (username, email, password, is_admin, is_approved) VALUES ($1, $2, $3, $4, $5)`,
    [username, email, hashed, isFirstUser, isFirstUser]
  )

  return NextResponse.json({ success: true, requiresApproval: !isFirstUser })
}