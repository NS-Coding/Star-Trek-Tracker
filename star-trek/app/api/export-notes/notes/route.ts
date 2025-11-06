import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const { selectedIds, includeOthers } = await req.json() as { selectedIds: string[]; includeOthers?: boolean }
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
    return NextResponse.json({ notes: [] })
  }
  // Fetch notes with joins and filter by selected content and optional user
  const params: any[] = []
  let idx = 1
  const userFilter = includeOthers ? "" : `n.user_id = $${idx++}`
  if (!includeOthers) params.push(userId)
  params.push(selectedIds)
  const selectedFilter = `(
    n.show_id = ANY($${idx}::uuid[]) OR
    n.season_id = ANY($${idx}::uuid[]) OR
    n.movie_id = ANY($${idx}::uuid[]) OR
    (ep.id IS NOT NULL AND (s.id = ANY($${idx}::uuid[]) OR s.show_id = ANY($${idx}::uuid[])))
  )`

  const whereClause = [userFilter, selectedFilter].filter(Boolean).join(" AND ")

  const { rows: notes } = await query<any>(
    `SELECT n.id, n.content, n.created_at,
            u.username,
            -- direct show note context
            sh.id      AS show_id,   sh.title  AS show_title,   sh."order" AS show_order,
            -- direct season note context
            se.id      AS season_id, se.number AS season_number, sh2.title  AS season_show_title, sh2."order" AS season_show_order,
            -- episode note context with its season's show
            ep.id      AS episode_id, ep.title AS episode_title, ep.episode_number,
            s.number   AS ep_season_number, sh3.title AS ep_show_title, sh3."order" AS ep_show_order,
            -- movie note context
            mv.id      AS movie_id, mv.title   AS movie_title, mv."order" AS movie_order
     FROM notes n
     LEFT JOIN users u ON n.user_id = u.id
     LEFT JOIN shows sh ON n.show_id = sh.id
     LEFT JOIN seasons se ON n.season_id = se.id
     LEFT JOIN shows sh2 ON se.show_id = sh2.id
     LEFT JOIN episodes ep ON n.episode_id = ep.id
     LEFT JOIN seasons s ON ep.season_id = s.id
     LEFT JOIN shows sh3 ON s.show_id = sh3.id
     LEFT JOIN movies mv ON n.movie_id = mv.id
     WHERE ${whereClause}
     ORDER BY n.created_at DESC`,
    params
  )

  const mapped = notes.map((n: any) => {
    let contentId = ""
    let contentType = ""
    let contentTitle = ""
    let sort: { typeRank: number; showOrder: number; seasonNum: number; episodeNum: number; movieOrder: number } = {
      typeRank: 0,
      showOrder: 9999,
      seasonNum: 0,
      episodeNum: 0,
      movieOrder: 9999,
    }
    if (n.episode_id) {
      contentId = n.episode_id
      contentType = "episode"
      const showTitle = n.ep_show_title ?? n.season_show_title ?? n.show_title ?? ""
      const seasonNum = n.ep_season_number ?? n.season_number ?? ""
      const episodeNum = n.episode_number ?? ""
      contentTitle = `${showTitle} S${seasonNum}E${episodeNum}: ${n.episode_title}`.trim()
      sort = {
        typeRank: 0,
        showOrder: (n.ep_show_order ?? n.season_show_order ?? n.show_order ?? 9999),
        seasonNum: seasonNum || 0,
        episodeNum: n.episode_number,
        movieOrder: 9999,
      }
    } else if (n.season_id) {
      contentId = n.season_id
      contentType = "season"
      contentTitle = `${n.season_show_title} S${n.season_number}`
      sort = {
        typeRank: 0,
        showOrder: n.season_show_order ?? 9999,
        seasonNum: n.season_number,
        episodeNum: 0,
        movieOrder: 9999,
      }
    } else if (n.show_id) {
      contentId = n.show_id
      contentType = "show"
      contentTitle = n.show_title
      sort = {
        typeRank: 0,
        showOrder: n.show_order ?? 9999,
        seasonNum: 0,
        episodeNum: 0,
        movieOrder: 9999,
      }
    } else if (n.movie_id) {
      contentId = n.movie_id
      contentType = "movie"
      contentTitle = n.movie_title
      sort = {
        typeRank: 1,
        showOrder: 9999,
        seasonNum: 0,
        episodeNum: 0,
        movieOrder: n.movie_order ?? 9999,
      }
    }

    return {
      id: n.id,
      username: n.username,
      content: n.content,
      timestamp: new Date(n.created_at).toISOString(),
      contentId,
      contentType,
      contentTitle,
      _sort: sort,
    }
  })

  // Sort notes by canonical content order
  const sorted = mapped.sort((a, b) => {
    if (a._sort.typeRank !== b._sort.typeRank) return a._sort.typeRank - b._sort.typeRank
    if (a._sort.typeRank === 0) {
      // Shows domain
      if (a._sort.showOrder !== b._sort.showOrder) return (a._sort.showOrder ?? 9999) - (b._sort.showOrder ?? 9999)
      if (a._sort.seasonNum !== b._sort.seasonNum) return a._sort.seasonNum - b._sort.seasonNum
      if (a._sort.episodeNum !== b._sort.episodeNum) return a._sort.episodeNum - b._sort.episodeNum
      // same bucket: stable by timestamp for tie-breaker
      return a.timestamp.localeCompare(b.timestamp)
    }
    // Movies domain
    if (a._sort.movieOrder !== b._sort.movieOrder) return (a._sort.movieOrder ?? 9999) - (b._sort.movieOrder ?? 9999)
    return a.timestamp.localeCompare(b.timestamp)
  })

  // Strip private sort key
  const cleaned = sorted.map(({ _sort, ...rest }) => rest)

  return NextResponse.json({ notes: cleaned })
}
