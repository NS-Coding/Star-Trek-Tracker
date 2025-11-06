import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { query } from "@/lib/db"

type ActionBody = {
  userId: string
  action: "approve" | "reject" | "toggleAdmin"
  makeAdmin?: boolean
}

export async function GET() {
  const session = await getAuthSession()
  if (!session || !session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { rows } = await query<{
    id: string; username: string; email: string; is_admin: boolean; is_approved: boolean; created_at: string; ratings_count: string
  }>(
    `SELECT u.id, u.username, u.email, u.is_admin, u.is_approved, u.created_at,
            (SELECT COUNT(*)::text FROM ratings r WHERE r.user_id = u.id) AS ratings_count
     FROM users u
     ORDER BY u.created_at ASC`
  )

  const data = rows.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    isAdmin: u.is_admin,
    isApproved: u.is_approved,
    createdAt: new Date(u.created_at).toISOString().split("T")[0],
    ratedCount: parseInt(u.ratings_count, 10),
    watchedCount: 0,
  }))

  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const session = await getAuthSession()
  if (!session || !session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json()) as ActionBody
  const { userId, action } = body
  if (!userId || !action) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }

  try {
    let updated
    switch (action) {
      case "approve":
        updated = await query(`UPDATE users SET is_approved = true, updated_at = now() WHERE id = $1 RETURNING id, username, email, is_admin, is_approved, created_at`, [userId])
        break
      case "reject":
        await query(`DELETE FROM users WHERE id = $1`, [userId])
        return NextResponse.json({ success: true })
      case "toggleAdmin":
        updated = await query(`UPDATE users SET is_admin = $2, updated_at = now() WHERE id = $1 RETURNING id, username, email, is_admin, is_approved, created_at`, [userId, body.makeAdmin ?? false])
        break
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
    return NextResponse.json({ success: true, user: updated.rows[0] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
