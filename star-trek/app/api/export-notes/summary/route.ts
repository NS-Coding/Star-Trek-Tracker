import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const includeOthers = url.searchParams.get("includeOthers") === "1"

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  // Shows
  const { rows: shows } = await query<{ id: string; title: string; order: number | null }>(
    `SELECT id, title, "order" FROM shows ORDER BY "order" ASC NULLS LAST, title ASC`
  )

  // Seasons (basic info)
  const { rows: seasons } = await query<{ id: string; number: number; show_id: string }>(
    `SELECT id, number, show_id FROM seasons ORDER BY number ASC`
  )

  // Episodes count per season
  const { rows: seasonEpCounts } = await query<{ season_id: string; cnt: string }>(
    `SELECT season_id, COUNT(*)::text AS cnt FROM episodes GROUP BY season_id`
  )
  const seasonTotalEp = new Map<string, number>(seasonEpCounts.map(r => [r.season_id, parseInt(r.cnt, 10)]))

  // Movies
  const { rows: movies } = await query<{ id: string; title: string; order: number | null }>(
    `SELECT id, title, "order" FROM movies ORDER BY "order" ASC NULLS LAST, title ASC`
  )

  // Notes grouped for counts
  // Notes breakdown
  const userFilter = includeOthers ? [] : [userId]
  const userSql = includeOthers ? "" : "WHERE n.user_id = $1"
  const paramIdxOffset = includeOthers ? 0 : 1

  // Episode notes with season and show linkage
  const { rows: episodeNotes } = await query<{ episode_id: string; season_id: string; show_id: string }>(
    `SELECT n.episode_id, s.id AS season_id, s.show_id
     FROM notes n
     JOIN episodes e ON n.episode_id = e.id
     JOIN seasons s ON e.season_id = s.id
     ${userSql}`,
    userFilter as any
  )

  const { rows: showNotes } = await query<{ show_id: string }>(
    `SELECT n.show_id FROM notes n WHERE n.show_id IS NOT NULL ${includeOthers ? "" : "AND n.user_id = $1"}`,
    userFilter as any
  )

  const { rows: seasonNotes } = await query<{ season_id: string; show_id: string }>(
    `SELECT s.id AS season_id, s.show_id
     FROM notes n JOIN seasons s ON n.season_id = s.id
     ${userSql}`,
    userFilter as any
  )

  const { rows: movieNotes } = await query<{ movie_id: string }>(
    `SELECT n.movie_id FROM notes n WHERE n.movie_id IS NOT NULL ${includeOthers ? "" : "AND n.user_id = $1"}`,
    userFilter as any
  )

  // Compute episode-level noted counts per season and show (distinct episodes)
  const notedEpisodeIdsBySeason = new Map<string, Set<string>>()
  const notedEpisodeIdsByShow = new Map<string, Set<string>>()
  for (const n of episodeNotes) {
    const seasonId = n.season_id
    const showId = n.show_id
    if (!notedEpisodeIdsBySeason.has(seasonId)) notedEpisodeIdsBySeason.set(seasonId, new Set())
    notedEpisodeIdsBySeason.get(seasonId)!.add(n.episode_id)
    if (!notedEpisodeIdsByShow.has(showId)) notedEpisodeIdsByShow.set(showId, new Set())
    notedEpisodeIdsByShow.get(showId)!.add(n.episode_id)
  }

  // Aggregate note counts per entity
  const noteCountByShow = new Map<string, number>()
  const noteCountBySeason = new Map<string, number>()
  const noteCountByMovie = new Map<string, number>()
  for (const n of showNotes) noteCountByShow.set(n.show_id, (noteCountByShow.get(n.show_id) || 0) + 1)
  for (const n of seasonNotes) noteCountBySeason.set(n.season_id, (noteCountBySeason.get(n.season_id) || 0) + 1)
  for (const n of movieNotes) noteCountByMovie.set(n.movie_id, (noteCountByMovie.get(n.movie_id) || 0) + 1)

  // Include episode-notes in counts at parent levels for visibility
  for (const [seasonId, set] of notedEpisodeIdsBySeason) {
    noteCountBySeason.set(seasonId, (noteCountBySeason.get(seasonId) || 0) + set.size)
  }
  // For shows, add distinct episodes and season-level notes to total counts
  for (const show of shows) {
    const showId = show.id
    const episodeCount = notedEpisodeIdsByShow.get(showId)?.size || 0
    noteCountByShow.set(showId, (noteCountByShow.get(showId) || 0) + episodeCount)
    const seasonsForShow = seasons.filter((s) => s.show_id === showId)
    let seasonLevelNotes = 0
    for (const s of seasonsForShow) {
      seasonLevelNotes += noteCountBySeason.get(s.id) || 0
    }
    noteCountByShow.set(showId, (noteCountByShow.get(showId) || 0) + seasonLevelNotes)
  }

  const items: Array<{
    id: string
    title: string
    type: "show" | "season" | "movie"
    noteCount: number
    progressEpisodes?: { noted: number; total: number }
    displayTitle?: string
  }> = []

  // Shows
  for (const sh of shows) {
    const totalEpisodes = seasons
      .filter((s) => s.show_id === sh.id)
      .reduce((acc, s) => acc + (seasonTotalEp.get(s.id) || 0), 0)
    const notedEpisodes = notedEpisodeIdsByShow.get(sh.id)?.size || 0
    const noteCount = noteCountByShow.get(sh.id) || 0
    items.push({
      id: sh.id,
      title: sh.title,
      type: "show",
      noteCount,
      progressEpisodes: { noted: notedEpisodes, total: totalEpisodes },
      displayTitle: `${sh.title} (${notedEpisodes}/${totalEpisodes})`,
    })
  }

  // Seasons are intentionally not included as selectable items

  // Movies
  for (const m of movies) {
    const noteCount = noteCountByMovie.get(m.id) || 0
    items.push({ id: m.id, title: m.title, type: "movie", noteCount, displayTitle: m.title })
  }

  // Only include entries that have notes when includeOthers filter applied or user's notes
  const filtered = items
    .filter((i) => i.noteCount > 0 || (i.progressEpisodes && i.progressEpisodes.noted > 0))
    .sort((a, b) => {
      // Sort shows/movies by their order fields; shows earlier than movies
      const aKey = a.type === "show" ? 0 : 1
      const bKey = b.type === "show" ? 0 : 1
      if (aKey !== bKey) return aKey - bKey
      // We don't have order field here; rely on initial query ordering by show.order/title and movie.order/title
      return a.title.localeCompare(b.title)
    })

  return NextResponse.json({ items: filtered })
}
