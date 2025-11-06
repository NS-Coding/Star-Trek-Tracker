import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET() {
  const session = await getAuthSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fetch user with counts for convenience
  const { rows: userRows } = await query<{ id: string; username: string; email: string; is_admin: boolean; created_at: string }>(
    `SELECT id, username, email, is_admin, created_at FROM users WHERE id = $1`,
    [session.user.id]
  )
  const user = userRows[0]

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Totals
  const [episodesCnt, moviesCnt, seasonsCnt, showsCnt] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM episodes`),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM movies`),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM seasons`),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM shows`),
  ])
  const totalEpisodes = parseInt(episodesCnt.rows[0].count, 10)
  const totalMovies = parseInt(moviesCnt.rows[0].count, 10)
  const totalSeasons = parseInt(seasonsCnt.rows[0].count, 10)
  const totalShows = parseInt(showsCnt.rows[0].count, 10)
  const totalEpisodesMovies = totalEpisodes + totalMovies // still used for Watched (global)
  const totalRateableContent = totalEpisodes + totalMovies + totalSeasons + totalShows
  const totalNoteableContent = totalRateableContent

  const { rows: watchedCntRows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM watch_progress WHERE watched = true AND (episode_id IS NOT NULL OR movie_id IS NOT NULL)`
  )
  const watchedEpisodesMovies = parseInt(watchedCntRows[0].count, 10)

  const { rows: ratedCntRows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ratings WHERE user_id = $1 AND (
      episode_id IS NOT NULL OR movie_id IS NOT NULL OR season_id IS NOT NULL OR show_id IS NOT NULL
    )`,
    [user.id]
  )
  const ratedAllContent = parseInt(ratedCntRows[0].count, 10)

  const { rows: notesCntRows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM notes WHERE user_id = $1 AND (
      episode_id IS NOT NULL OR movie_id IS NOT NULL OR season_id IS NOT NULL OR show_id IS NOT NULL
    )`,
    [user.id]
  )
  const notesAllContent = parseInt(notesCntRows[0].count, 10)

  const { rows: userRatingsRows } = await query<{ value: number }>(
    `SELECT value FROM ratings WHERE user_id = $1`,
    [user.id]
  )
  const ratingsCount = userRatingsRows.length
  const averageRating = ratingsCount === 0 ? 0 : (userRatingsRows.reduce((s, r) => s + r.value, 0) / ratingsCount)

  // Favorites = top 5 highest ratings
  const { rows: favorites } = await query<any>(
    `SELECT r.id, r.value,
            sh.title AS show_title,
            mv.title AS movie_title,
            se.number AS season_number,
            sh2.title AS season_show_title,
            ep.title AS episode_title,
            se2.number AS episode_season_number,
            sh3.title AS episode_show_title,
            r.updated_at AS rating_updated_at,
            r.created_at AS rating_created_at
     FROM ratings r
     LEFT JOIN shows sh ON r.show_id = sh.id
     LEFT JOIN movies mv ON r.movie_id = mv.id
     LEFT JOIN seasons se ON r.season_id = se.id
     LEFT JOIN shows sh2 ON se.show_id = sh2.id
     LEFT JOIN episodes ep ON r.episode_id = ep.id
     LEFT JOIN seasons se2 ON ep.season_id = se2.id
     LEFT JOIN shows sh3 ON se2.show_id = sh3.id
     WHERE r.user_id = $1
     ORDER BY r.value DESC
     LIMIT 5`,
    [user.id]
  )

  function ratingTitle(r: any) {
    if (r.show) return r.show.title
    if (r.movie) return r.movie.title
    if (r.season) return `${r.season.show.title} - Season ${r.season.number}`
    if (r.episode)
      return `${r.episode.season.show.title} S${r.episode.season.number}E: ${r.episode.title}`
    return "Unknown"
  }

  const favoritesOut = favorites.map((r: any) => ({
    id: r.id,
    rating: r.value,
    title: ratingTitle({
      show: r.show_title ? { title: r.show_title } : null,
      movie: r.movie_title ? { title: r.movie_title } : null,
      season: r.season_number ? { number: r.season_number, show: { title: r.season_show_title } } : null,
      episode: r.episode_title ? { title: r.episode_title, season: { number: r.episode_season_number, show: { title: r.episode_show_title } } } : null,
    }),
  }))

  // My notes latest 5
  const { rows: notes } = await query<any>(
    `SELECT n.id, n.content, n.updated_at,
            sh.title AS show_title,
            mv.title AS movie_title,
            se.number AS season_number,
            sh2.title AS season_show_title,
            ep.title AS episode_title,
            se2.number AS episode_season_number,
            sh3.title AS episode_show_title,
            n.created_at
     FROM notes n
     LEFT JOIN shows sh ON n.show_id = sh.id
     LEFT JOIN movies mv ON n.movie_id = mv.id
     LEFT JOIN seasons se ON n.season_id = se.id
     LEFT JOIN shows sh2 ON se.show_id = sh2.id
     LEFT JOIN episodes ep ON n.episode_id = ep.id
     LEFT JOIN seasons se2 ON ep.season_id = se2.id
     LEFT JOIN shows sh3 ON se2.show_id = sh3.id
     WHERE n.user_id = $1
     ORDER BY n.updated_at DESC
     LIMIT 5`,
    [user.id]
  )

  function noteTitle(n: any) {
    if (n.show) return n.show.title
    if (n.movie) return n.movie.title
    if (n.season) return `${n.season.show.title} - Season ${n.season.number}`
    if (n.episode)
      return `${n.episode.season.show.title} S${n.episode.season.number}E: ${n.episode.title}`
    return "Unknown"
  }

  const notesOut = notes.map((n: any) => ({
    id: n.id,
    title: noteTitle({
      show: n.show_title ? { title: n.show_title } : null,
      movie: n.movie_title ? { title: n.movie_title } : null,
      season: n.season_number ? { number: n.season_number, show: { title: n.season_show_title } } : null,
      episode: n.episode_title ? { title: n.episode_title, season: { number: n.episode_season_number, show: { title: n.episode_show_title } } } : null,
    }),
    excerpt: (n.content || '').slice(0, 120),
    updatedAt: n.updated_at,
  }))

  // Recent activity: merge ratings & notes latest 10
  const activity = [
      ...favorites.map((r: any) => ({
        type: "rating",
        title: ratingTitle({
          show: r.show_title ? { title: r.show_title } : null,
          movie: r.movie_title ? { title: r.movie_title } : null,
          season: r.season_number ? { number: r.season_number, show: { title: r.season_show_title } } : null,
          episode: r.episode_title ? { title: r.episode_title, season: { number: r.episode_season_number, show: { title: r.episode_show_title } } } : null,
        }),
        value: r.value,
        timestamp: new Date(r.rating_updated_at || r.rating_created_at).toISOString(),
      })),
      ...notes.map((n: any) => ({
        type: "note",
        title: noteTitle({
          show: n.show_title ? { title: n.show_title } : null,
          movie: n.movie_title ? { title: n.movie_title } : null,
          season: n.season_number ? { number: n.season_number, show: { title: n.season_show_title } } : null,
          episode: n.episode_title ? { title: n.episode_title, season: { number: n.episode_season_number, show: { title: n.episode_show_title } } } : null,
        }),
        timestamp: new Date(n.updated_at || n.created_at).toISOString(),
      })),
    ]
    .sort((a: any, b: any) => (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))
    .slice(0, 10)
    .map((a: any) => ({
      type: a.type,
      title: a.title,
      value: a.value ?? undefined,
      timestamp: a.timestamp,
    }))

  return NextResponse.json({
    id: user.id,
    username: user.username,
    email: user.email,
    joinDate: user.created_at,
    isAdmin: user.is_admin,
    stats: {
      totalWatched: watchedEpisodesMovies,
      totalRated: ratedAllContent,
      notesWithContent: notesAllContent,
      totalEpisodesMovies,
      totalRateableContent,
      totalNoteableContent,
      averageRating,
    },
    favorites: favoritesOut,
    notes: notesOut,
    recentActivity: activity,
  })
}
