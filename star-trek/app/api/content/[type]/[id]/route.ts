import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthSession } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: { type: string; id: string } }
) {
  const { type, id } = params

  try {
    const session = await getAuthSession()
    const currentUserId = session?.user?.id
    let content: any = null
    
    switch (type) {
      case 'show':
        {
          const { rows: showRows } = await query<{ id: string; title: string; artwork_url: string | null; description: string | null; imdb_rating: number | null }>(
            `SELECT id, title, artwork_url, description, imdb_rating FROM shows WHERE id = $1`,
            [id]
          )
          if (showRows.length === 0) break
          const { rows: seasons } = await query<{ id: string; number: number }>(
            `SELECT id, number FROM seasons WHERE show_id = $1 ORDER BY number ASC`,
            [id]
          )
          const { rows: ratings } = await query<{ user_id: string; value: number }>(
            `SELECT user_id, value FROM ratings WHERE show_id = $1`,
            [id]
          )
          const { rows: watch } = await query<{ watched: boolean; updated_at: string }>(
            `SELECT watched, updated_at FROM watch_progress WHERE show_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
            [id]
          )
          const watchStatusOut = watch.map(w => ({ watched: w.watched, createdAt: w.updated_at }))
          // progress for show: total episodes and watched episodes
          const { rows: epCounts } = await query<{ total: string }>(
            `SELECT COUNT(*)::text AS total
             FROM episodes e
             JOIN seasons s ON s.id = e.season_id
             WHERE s.show_id = $1`,
            [id]
          )
          const { rows: watchedEpCounts } = await query<{ watched: string }>(
            `SELECT COUNT(DISTINCT wp.episode_id)::text AS watched
             FROM watch_progress wp
             WHERE wp.watched = TRUE
               AND wp.episode_id IN (
                 SELECT e.id FROM episodes e JOIN seasons s ON s.id = e.season_id WHERE s.show_id = $1
               )`,
            [id]
          )
          const showProgress = {
            total: parseInt(epCounts[0]?.total || '0', 10),
            watched: parseInt(watchedEpCounts[0]?.watched || '0', 10),
          }
          // per-season progress
          const { rows: seasonProgressRows } = await query<{ season_id: string; total: string; watched: string }>(
            `WITH ep AS (
               SELECT e.id, e.season_id FROM episodes e WHERE e.season_id = ANY($1::uuid[])
             ),
             wt AS (
               SELECT DISTINCT episode_id FROM watch_progress WHERE watched = TRUE AND episode_id IN (SELECT id FROM ep)
             )
             SELECT
               s.id AS season_id,
               COUNT(ep.id)::text AS total,
               COALESCE((SELECT COUNT(*) FROM wt JOIN ep ON ep.id = wt.episode_id AND ep.season_id = s.id), 0)::text AS watched
             FROM seasons s
             LEFT JOIN ep ON ep.season_id = s.id
             WHERE s.id = ANY($1::uuid[])
             GROUP BY s.id
            `,
            [seasons.map(s => s.id)]
          )
          const seasonProgressMap = new Map<string, { total: number; watched: number }>()
          seasonProgressRows.forEach(r => seasonProgressMap.set(r.season_id, { total: parseInt(r.total, 10), watched: parseInt(r.watched, 10) }))
          content = {
            id: showRows[0].id,
            title: showRows[0].title,
            artworkUrl: showRows[0].artwork_url,
            description: showRows[0].description,
            imdbRating: showRows[0].imdb_rating,
            seasons: seasons.map(s => ({ id: s.id, number: s.number, progress: seasonProgressMap.get(s.id) || { total: 0, watched: 0 } })),
            ratings,
            watchStatus: watchStatusOut,
            progress: showProgress,
          }
        }
        break
      
      case 'movie':
        {
          const { rows: movieRows } = await query<{ id: string; title: string; artwork_url: string | null; release_date: string | null; description: string | null; imdb_rating: number | null }>(
            `SELECT id, title, artwork_url, release_date, description, imdb_rating FROM movies WHERE id = $1`,
            [id]
          )
          if (movieRows.length === 0) break
          const { rows: ratings } = await query<{ user_id: string; value: number }>(
            `SELECT user_id, value FROM ratings WHERE movie_id = $1`,
            [id]
          )
          const { rows: watch } = await query<{ watched: boolean; updated_at: string }>(
            `SELECT watched, updated_at FROM watch_progress WHERE movie_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
            [id]
          )
          const watchStatusOut = watch.map(w => ({ watched: w.watched, createdAt: w.updated_at }))
          content = {
            id: movieRows[0].id,
            title: movieRows[0].title,
            artworkUrl: movieRows[0].artwork_url,
            releaseDate: movieRows[0].release_date,
            description: movieRows[0].description,
            imdbRating: movieRows[0].imdb_rating,
            ratings,
            watchStatus: watchStatusOut,
          }
        }
        break
      
      case 'season':
        {
          const { rows: seasonRows } = await query<{ id: string; number: number; show_id: string; imdb_rating: number | null }>(
            `SELECT id, number, show_id, imdb_rating FROM seasons WHERE id = $1`,
            [id]
          )
          if (seasonRows.length === 0) break
          const showId = seasonRows[0].show_id
          const { rows: show } = await query<{ id: string; title: string; artwork_url: string | null }>(
            `SELECT id, title, artwork_url FROM shows WHERE id = $1`,
            [showId]
          )
          const { rows: episodes } = await query<{ id: string; title: string; episode_number: number }>(
            `SELECT id, title, episode_number FROM episodes WHERE season_id = $1 ORDER BY episode_number ASC`,
            [id]
          )
          const { rows: ratings } = await query<{ user_id: string; value: number }>(
            `SELECT user_id, value FROM ratings WHERE season_id = $1`,
            [id]
          )
          const { rows: watch } = await query<{ watched: boolean; updated_at: string }>(
            `SELECT watched, updated_at FROM watch_progress WHERE season_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
            [id]
          )
          const watchStatusOut = watch.map(w => ({ watched: w.watched, createdAt: w.updated_at }))
          // season progress from episodes
          const total = episodes.length
          const { rows: watchedEps } = await query<{ watched: string }>(
            `SELECT COUNT(DISTINCT episode_id)::text AS watched
             FROM watch_progress
             WHERE watched = TRUE AND episode_id = ANY($1::uuid[])`,
            [episodes.map(e => e.id)]
          )
          const seasonProgress = { total, watched: parseInt(watchedEps[0]?.watched || '0', 10) }
          content = {
            id: seasonRows[0].id,
            number: seasonRows[0].number,
            show: show.length ? { id: show[0].id, title: show[0].title, artworkUrl: show[0].artwork_url } : null,
            episodes: episodes.map(e => ({ id: e.id, title: e.title, episodeNumber: e.episode_number })),
            imdbRating: seasonRows[0].imdb_rating,
            ratings,
            watchStatus: watchStatusOut,
            progress: seasonProgress,
          }
        }
        break
      
      case 'episode':
        {
          const { rows: epRows } = await query<{ id: string; title: string; episode_number: number; season_id: string; description: string | null; air_date: string | null; artwork_url: string | null; imdb_rating: number | null; runtime: number | null }>(
            `SELECT id, title, episode_number, season_id, description, air_date, artwork_url, imdb_rating, runtime FROM episodes WHERE id = $1`,
            [id]
          )
          if (epRows.length === 0) break
          const seasonId = epRows[0].season_id
          const { rows: season } = await query<{ id: string; number: number; show_id: string }>(
            `SELECT id, number, show_id FROM seasons WHERE id = $1`,
            [seasonId]
          )
          let seasonOut: any = null
          if (season.length) {
            const { rows: show } = await query<{ id: string; title: string; artwork_url: string | null }>(
              `SELECT id, title, artwork_url FROM shows WHERE id = $1`,
              [season[0].show_id]
            )
            seasonOut = {
              id: season[0].id,
              number: season[0].number,
              show: show.length ? { id: show[0].id, title: show[0].title, artworkUrl: show[0].artwork_url } : null,
            }
          }
          const { rows: ratings } = await query<{ user_id: string; value: number }>(
            `SELECT user_id, value FROM ratings WHERE episode_id = $1`,
            [id]
          )
          const { rows: watch } = await query<{ watched: boolean; updated_at: string }>(
            `SELECT watched, updated_at FROM watch_progress WHERE episode_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
            [id]
          )
          const watchStatusOut = watch.map(w => ({ watched: w.watched, createdAt: w.updated_at }))
          content = {
            id: epRows[0].id,
            title: epRows[0].title,
            episodeNumber: epRows[0].episode_number,
            season: seasonOut,
            description: epRows[0].description,
            airDate: epRows[0].air_date,
            artworkUrl: epRows[0].artwork_url,
            imdbRating: epRows[0].imdb_rating,
            runtime: epRows[0].runtime,
            ratings,
            watchStatus: watchStatusOut,
          }
        }
        break
      
      default:
        return NextResponse.json({ error: 'Invalid content type' }, { status: 400 })
    }

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    // Format the content with additional fields needed by the UI
    const avgAll = content.ratings && content.ratings.length
      ? content.ratings.reduce((sum: number, r: any) => sum + (r.value ?? 0), 0) / content.ratings.length
      : null
    const userOwn = currentUserId && content.ratings
      ? (content.ratings.find((r: any) => r.user_id === currentUserId)?.value ?? null)
      : null

    const formattedContent = {
      ...content,
      type,
      watched: content.watchStatus?.length > 0 ? content.watchStatus[0].watched : false,
      watchDate: content.watchStatus?.length > 0 ? content.watchStatus[0].updated_at : undefined,
      userRating: userOwn,
      averageRating: avgAll,
      progress: content.progress ? {
        total: content.progress.total,
        watched: content.progress.watched,
      } : undefined,
    }

    try {
      console.log("/api/content/[type]/[id]: detail debug", {
        type,
        id,
        currentUserId,
        ratingsCount: Array.isArray(content.ratings) ? content.ratings.length : 0,
        userRating: formattedContent.userRating,
        averageRating: formattedContent.averageRating,
        imdbRating: formattedContent.imdbRating,
      })
    } catch {}

    return NextResponse.json(formattedContent)
  } catch (error) {
    console.error('Error fetching content:', error)
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 })
  }
}
