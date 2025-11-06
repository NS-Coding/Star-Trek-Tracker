import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const { username } = await req.json()
    if (!username) {
      return NextResponse.json({ error: "Missing username" }, { status: 400 })
    }

    const { rows } = await query<{ is_approved: boolean }>(
      `SELECT is_approved FROM users WHERE username = $1 LIMIT 1`,
      [username]
    )

    if (rows.length === 0) {
      // Do not reveal too much info; indicate not found generically
      return NextResponse.json({ exists: false }, { status: 200 })
    }

    return NextResponse.json({ exists: true, isApproved: rows[0].is_approved })
  } catch (e) {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
