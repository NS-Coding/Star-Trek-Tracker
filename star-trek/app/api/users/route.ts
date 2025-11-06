import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { rows } = await query<{ id: string; username: string; is_approved: boolean }>(
    `SELECT id, username, is_approved FROM users WHERE is_approved = TRUE ORDER BY username ASC`
  )

  const users = rows.map(r => ({ id: r.id, username: r.username }))
  return NextResponse.json({ users })
}
