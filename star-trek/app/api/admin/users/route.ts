import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAuthSession } from "@/lib/auth"

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

  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: { ratings: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  const data = await Promise.all(
    users.map(async (u) => {
      // Watched count placeholder (0) – depends on future schema relation
      const watchedCount = 0
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        isAdmin: u.isAdmin,
        isApproved: u.isApproved,
        createdAt: u.createdAt.toISOString().split("T")[0],
        ratedCount: u._count.ratings,
        watchedCount,
      }
    })
  )

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
        updated = await prisma.user.update({ where: { id: userId }, data: { isApproved: true } })
        break
      case "reject":
        updated = await prisma.user.update({ where: { id: userId }, data: { isApproved: false } })
        break
      case "toggleAdmin":
        updated = await prisma.user.update({ where: { id: userId }, data: { isAdmin: body.makeAdmin ?? false } })
        break
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
    return NextResponse.json({ success: true, user: updated })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
