import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(request: Request) {
  const session = await getAuthSession()
  const { searchParams } = new URL(request.url)
  const contentType = searchParams.get('type') || 'all'
  const sortBy = searchParams.get('sortBy') || 'order'
  const unwatchedOnly = searchParams.get('unwatchedOnly') === 'true'
  const searchQuery = searchParams.get('search') || ''

  try {
    let content: any[] = []

    // Handle different content types
    switch (contentType) {
      case 'show':
        {
          const whereSql = searchQuery ? `WHERE s.title ILIKE $1` : ''
          const params = searchQuery ? [`%${searchQuery}%`] : []
          const orderSql = sortBy === 'title' ? `ORDER BY s.title ASC` : `ORDER BY s."order" ASC NULLS LAST`
          const { rows: shows } = await query<{ id: string; title: string; order: number | null; artwork_url: string | null; imdb_rating: number | null }>(
            `SELECT s.id, s.title, s."order", s.artwork_url, s.imdb_rating FROM shows s ${whereSql} ${orderSql}`,
            params as any
          )
          // Seasons and episodes
          const { rows: seasons } = await query<{ id: string; show_id: string; number: number; artwork_url: string | null; imdb_rating: number | null; avg_rating: number | null }>(
            `SELECT s.id, s.show_id, s.number, s.artwork_url, s.imdb_rating,
                    (SELECT AVG(value)::float FROM ratings r WHERE r.season_id = s.id) AS avg_rating
             FROM seasons s WHERE s.show_id = ANY($1::uuid[]) ORDER BY s.number ASC`,
            [shows.map(s => s.id)]
          )
          const { rows: episodes } = await query<{ id: string; season_id: string; title: string; episode_number: number; artwork_url: string | null; imdb_rating: number | null; avg_rating: number | null }>(
            `SELECT e.id, e.season_id, e.title, e.episode_number, e.artwork_url, e.imdb_rating,
                    (SELECT AVG(value)::float FROM ratings r WHERE r.episode_id = e.id) AS avg_rating
             FROM episodes e WHERE e.season_id = ANY($1::uuid[]) ORDER BY e.episode_number ASC`,
            [seasons.map(se => se.id)]
          )
          // Build watch status sets for this show result
          const showIds = shows.map(s => s.id)
          const seasonIds = seasons.map(se => se.id)
          const episodeIds = episodes.map(ep => ep.id)
          const showWatched = new Map<string, string>() // id -> updated_at
          const seasonWatched = new Map<string, string>()
          const episodeWatched = new Map<string, string>()
          if (showIds.length) {
            const { rows } = await query<{ show_id: string; updated_at: string }>(`SELECT show_id, updated_at FROM watch_progress WHERE show_id = ANY($1::uuid[])`, [showIds])
            rows.forEach(r => r.show_id && showWatched.set(r.show_id, r.updated_at))
          }
          if (seasonIds.length) {
            const { rows } = await query<{ season_id: string; updated_at: string }>(`SELECT season_id, updated_at FROM watch_progress WHERE season_id = ANY($1::uuid[])`, [seasonIds])
            rows.forEach(r => r.season_id && seasonWatched.set(r.season_id, r.updated_at))
          }
          if (episodeIds.length) {
            const { rows } = await query<{ episode_id: string; updated_at: string }>(`SELECT episode_id, updated_at FROM watch_progress WHERE episode_id = ANY($1::uuid[])`, [episodeIds])
            rows.forEach(r => r.episode_id && episodeWatched.set(r.episode_id, r.updated_at))
          }

          // Optionally pull per-user ratings/notes for shows/seasons/episodes
          const userIdShow = session?.user.id
          let showUserRatings: Record<string, { userId: string; value: number }[]> = {}
          let seasonUserRatings: Record<string, { userId: string; value: number }[]> = {}
          let episodeUserRatings: Record<string, { userId: string; value: number }[]> = {}
          let showUserNotes: Record<string, { userId: string }[]> = {}
          let seasonUserNotes: Record<string, { userId: string }[]> = {}
          let episodeUserNotes: Record<string, { userId: string }[]> = {}
          if (userIdShow) {
            if (showIds.length) {
              const { rows } = await query<{ show_id: string; user_id: string; value: number }>(
                `SELECT show_id, user_id, value FROM ratings WHERE user_id = $1 AND show_id = ANY($2::uuid[])`,
                [userIdShow, showIds]
              )
              rows.forEach(r => { (showUserRatings[r.show_id] ||= []).push({ userId: r.user_id, value: r.value }) })
              const { rows: n } = await query<{ show_id: string; user_id: string }>(
                `SELECT show_id, user_id FROM notes WHERE user_id = $1 AND show_id = ANY($2::uuid[])`,
                [userIdShow, showIds]
              )
              n.forEach(r => { (showUserNotes[r.show_id] ||= []).push({ userId: r.user_id }) })
            }
            if (seasonIds.length) {
              const { rows } = await query<{ season_id: string; user_id: string; value: number }>(
                `SELECT season_id, user_id, value FROM ratings WHERE user_id = $1 AND season_id = ANY($2::uuid[])`,
                [userIdShow, seasonIds]
              )
              rows.forEach(r => { (seasonUserRatings[r.season_id] ||= []).push({ userId: r.user_id, value: r.value }) })
              const { rows: n } = await query<{ season_id: string; user_id: string }>(
                `SELECT season_id, user_id FROM notes WHERE user_id = $1 AND season_id = ANY($2::uuid[])`,
                [userIdShow, seasonIds]
              )
              n.forEach(r => { (seasonUserNotes[r.season_id] ||= []).push({ userId: r.user_id }) })
            }
            if (episodeIds.length) {
              const { rows } = await query<{ episode_id: string; user_id: string; value: number }>(
                `SELECT episode_id, user_id, value FROM ratings WHERE user_id = $1 AND episode_id = ANY($2::uuid[])`,
                [userIdShow, episodeIds]
              )
              rows.forEach(r => { (episodeUserRatings[r.episode_id] ||= []).push({ userId: r.user_id, value: r.value }) })
              const { rows: n } = await query<{ episode_id: string; user_id: string }>(
                `SELECT episode_id, user_id FROM notes WHERE user_id = $1 AND episode_id = ANY($2::uuid[])`,
                [userIdShow, episodeIds]
              )
              n.forEach(r => { (episodeUserNotes[r.episode_id] ||= []).push({ userId: r.user_id }) })
            }
          }

          // Pre-compute episodes by season for fast counts
          const episodesBySeason = new Map<string, { id: string }[]>()
          for (const ep of episodes) {
            const list = episodesBySeason.get(ep.season_id) || []
            list.push(ep)
            episodesBySeason.set(ep.season_id, list)
          }

          content = shows.map(sh => ({
            id: sh.id,
            title: sh.title,
            order: sh.order || 0,
            artworkUrl: sh.artwork_url || undefined,
            imdbRating: sh.imdb_rating || undefined,
            watchStatus: showWatched.has(sh.id) ? [{ watched: true, at: showWatched.get(sh.id) }] : [],
            // Build seasons
            seasons: seasons
              .filter(se => se.show_id === sh.id)
              .map(se => ({
                id: se.id,
                number: se.number,
                imdbRating: se.imdb_rating || undefined,
                aggregateRating: typeof se.avg_rating === 'number' ? se.avg_rating : undefined,
                ratings: seasonUserRatings[se.id] || [],
                watchStatus: seasonWatched.has(se.id) ? [{ watched: true, at: seasonWatched.get(se.id) }] : [],
                notes: seasonUserNotes[se.id] || [],
                episodes: episodes
                  .filter(ep => ep.season_id === se.id)
                  .map(ep => ({
                    id: ep.id,
                    title: ep.title,
                    episodeNumber: ep.episode_number,
                    imdbRating: ep.imdb_rating || undefined,
                    aggregateRating: typeof ep.avg_rating === 'number' ? ep.avg_rating : undefined,
                    ratings: episodeUserRatings[ep.id] || [],
                    watchStatus: episodeWatched.has(ep.id) ? [{ watched: true, at: episodeWatched.get(ep.id) }] : [],
                    notes: episodeUserNotes[ep.id] || [],
                  })),
                // season progress
                progress: {
                  total: (episodesBySeason.get(se.id) || []).length,
                  watched: (episodesBySeason.get(se.id) || []).filter(e => episodeWatched.has(e.id)).length,
                },
              })),
            ratings: showUserRatings[sh.id] || [],
            notes: showUserNotes[sh.id] || [],
            // show progress
            progress: (() => {
              const seasonIdsForShow = seasons.filter(se => se.show_id === sh.id).map(se => se.id)
              const eps = seasonIdsForShow.flatMap(seid => episodesBySeason.get(seid) || [])
              const total = eps.length
              const watched = eps.filter(e => episodeWatched.has(e.id)).length
              return { total, watched }
            })(),
          }))
        }
        break

      case 'movie':
        {
          const whereSql = searchQuery ? `WHERE m.title ILIKE $1` : ''
          const params = searchQuery ? [`%${searchQuery}%`] : []
          const orderSql = sortBy === 'title' ? `ORDER BY m.title ASC` : sortBy === 'releaseDate' ? `ORDER BY m.release_date ASC NULLS LAST` : `ORDER BY m."order" ASC NULLS LAST`
          const { rows: movies } = await query<{ id: string; title: string; order: number | null; release_date: string | null; artwork_url: string | null; imdb_rating: number | null }>(
            `SELECT m.id, m.title, m."order", m.release_date, m.artwork_url, m.imdb_rating FROM movies m ${whereSql} ${orderSql}`,
            params as any
          )
          // fetch watch status (with date) for these movies
          const movieIds = movies.map(m => m.id)
          const watchedMap = new Map<string, string>()
          if (movieIds.length) {
            const { rows: wp } = await query<{ movie_id: string; updated_at: string }>(
              `SELECT movie_id, updated_at FROM watch_progress WHERE movie_id = ANY($1::uuid[])`,
              [movieIds]
            )
            wp.forEach(r => r.movie_id && watchedMap.set(r.movie_id, r.updated_at))
          }
          content = movies.map((m: any) => ({
            id: m.id,
            title: m.title,
            order: m.order || 0,
            releaseDate: m.release_date || undefined,
            artworkUrl: m.artwork_url || undefined,
            imdbRating: m.imdb_rating || undefined,
            ratings: [],
            watchStatus: watchedMap.has(m.id) ? [{ watched: true, at: watchedMap.get(m.id) }] : [],
            notes: [],
          }))
        }
        break

      case 'all':
      default:
        {
          // Build show list
          const whereSqlS = searchQuery ? `WHERE s.title ILIKE $1` : ''
          const paramsS = searchQuery ? [`%${searchQuery}%`] : []
          const orderSqlS = sortBy === 'title' ? `ORDER BY s.title ASC` : `ORDER BY s."order" ASC NULLS LAST`
          const { rows: shows } = await query<{ id: string; title: string; order: number | null; artwork_url: string | null; imdb_rating: number | null; avg_rating: number | null }>(
            `SELECT s.id, s.title, s."order", s.artwork_url, s.imdb_rating,
                    (SELECT AVG(value)::float FROM ratings r WHERE r.show_id = s.id) AS avg_rating
             FROM shows s ${whereSqlS} ${orderSqlS}`,
            paramsS as any
          )
          const { rows: seasons } = await query<{ id: string; show_id: string; number: number; artwork_url: string | null; imdb_rating: number | null; avg_rating: number | null }>(
            `SELECT s.id, s.show_id, s.number, s.artwork_url, s.imdb_rating,
                    (SELECT AVG(value)::float FROM ratings r WHERE r.season_id = s.id) AS avg_rating
             FROM seasons s WHERE s.show_id = ANY($1::uuid[]) ORDER BY s.number ASC`,
            [shows.map(s => s.id)]
          )
          const { rows: episodes } = await query<{ id: string; season_id: string; title: string; episode_number: number; artwork_url: string | null; imdb_rating: number | null; avg_rating: number | null }>(
            `SELECT e.id, e.season_id, e.title, e.episode_number, e.artwork_url, e.imdb_rating,
                    (SELECT AVG(value)::float FROM ratings r WHERE r.episode_id = e.id) AS avg_rating
             FROM episodes e WHERE e.season_id = ANY($1::uuid[]) ORDER BY e.episode_number ASC`,
            [seasons.map(se => se.id)]
          )
          // watch status sets for shows, seasons, episodes (with date)
          const showIds = shows.map(s => s.id)
          const seasonIds = seasons.map(se => se.id)
          const episodeIds = episodes.map(ep => ep.id)
          const showWatched = new Map<string, string>()
          const seasonWatched = new Map<string, string>()
          const episodeWatched = new Map<string, string>()
          if (showIds.length) {
            const { rows } = await query<{ show_id: string; updated_at: string }>(`SELECT show_id, updated_at FROM watch_progress WHERE show_id = ANY($1::uuid[])`, [showIds])
            rows.forEach(r => r.show_id && showWatched.set(r.show_id, r.updated_at))
          }
          if (seasonIds.length) {
            const { rows } = await query<{ season_id: string; updated_at: string }>(`SELECT season_id, updated_at FROM watch_progress WHERE season_id = ANY($1::uuid[])`, [seasonIds])
            rows.forEach(r => r.season_id && seasonWatched.set(r.season_id, r.updated_at))
          }
          if (episodeIds.length) {
            const { rows } = await query<{ episode_id: string; updated_at: string }>(`SELECT episode_id, updated_at FROM watch_progress WHERE episode_id = ANY($1::uuid[])`, [episodeIds])
            rows.forEach(r => r.episode_id && episodeWatched.set(r.episode_id, r.updated_at))
          }
          // Per-user ratings/notes maps for shows/seasons/episodes
          const currentUserId = session?.user.id
          let showUserRatings: Record<string, { userId: string; value: number }[]> = {}
          let showUserNotes: Record<string, { userId: string }[]> = {}
          let seasonUserRatings: Record<string, { userId: string; value: number }[]> = {}
          let seasonUserNotes: Record<string, { userId: string }[]> = {}
          let episodeUserRatings: Record<string, { userId: string; value: number }[]> = {}
          let episodeUserNotes: Record<string, { userId: string }[]> = {}
          if (currentUserId) {
            if (showIds.length) {
              const { rows } = await query<{ show_id: string; user_id: string; value: number }>(
                `SELECT show_id, user_id, value FROM ratings WHERE user_id = $1 AND show_id = ANY($2::uuid[])`,
                [currentUserId, showIds]
              )
              rows.forEach(r => { (showUserRatings[r.show_id] ||= []).push({ userId: r.user_id, value: r.value }) })
              const { rows: n } = await query<{ show_id: string; user_id: string }>(
                `SELECT show_id, user_id FROM notes WHERE user_id = $1 AND show_id = ANY($2::uuid[])`,
                [currentUserId, showIds]
              )
              n.forEach(r => { (showUserNotes[r.show_id] ||= []).push({ userId: r.user_id }) })
            }
            if (seasonIds.length) {
              const { rows } = await query<{ season_id: string; user_id: string; value: number }>(
                `SELECT season_id, user_id, value FROM ratings WHERE user_id = $1 AND season_id = ANY($2::uuid[])`,
                [currentUserId, seasonIds]
              )
              rows.forEach(r => { (seasonUserRatings[r.season_id] ||= []).push({ userId: r.user_id, value: r.value }) })
              const { rows: n } = await query<{ season_id: string; user_id: string }>(
                `SELECT season_id, user_id FROM notes WHERE user_id = $1 AND season_id = ANY($2::uuid[])`,
                [currentUserId, seasonIds]
              )
              n.forEach(r => { (seasonUserNotes[r.season_id] ||= []).push({ userId: r.user_id }) })
            }
            if (episodeIds.length) {
              const { rows } = await query<{ episode_id: string; user_id: string; value: number }>(
                `SELECT episode_id, user_id, value FROM ratings WHERE user_id = $1 AND episode_id = ANY($2::uuid[])`,
                [currentUserId, episodeIds]
              )
              rows.forEach(r => { (episodeUserRatings[r.episode_id] ||= []).push({ userId: r.user_id, value: r.value }) })
              const { rows: n } = await query<{ episode_id: string; user_id: string }>(
                `SELECT episode_id, user_id FROM notes WHERE user_id = $1 AND episode_id = ANY($2::uuid[])`,
                [currentUserId, episodeIds]
              )
              n.forEach(r => { (episodeUserNotes[r.episode_id] ||= []).push({ userId: r.user_id }) })
            }
          }

          const showList = shows.map((sh: any) => ({
            id: sh.id,
            title: sh.title,
            order: sh.order || 0,
            artworkUrl: sh.artwork_url || undefined,
            imdbRating: sh.imdb_rating || undefined,
            aggregateRating: typeof sh.avg_rating === 'number' ? sh.avg_rating : undefined,
            watchStatus: showWatched.has(sh.id) ? [{ watched: true }] : [],
            seasons: seasons
              .filter((se: any) => se.show_id === sh.id)
              .map((se: any) => ({
                id: se.id,
                number: se.number,
                imdbRating: se.imdb_rating || undefined,
                aggregateRating: typeof se.avg_rating === 'number' ? se.avg_rating : undefined,
                ratings: seasonUserRatings[se.id] || [],
                watchStatus: seasonWatched.has(se.id) ? [{ watched: true }] : [],
                notes: seasonUserNotes[se.id] || [],
                episodes: episodes
                  .filter((ep: any) => ep.season_id === se.id)
                  .map((ep: any) => ({
                    id: ep.id,
                    title: ep.title,
                    episodeNumber: ep.episode_number,
                    imdbRating: ep.imdb_rating || undefined,
                    aggregateRating: typeof ep.avg_rating === 'number' ? ep.avg_rating : undefined,
                    ratings: episodeUserRatings[ep.id] || [],
                    watchStatus: episodeWatched.has(ep.id) ? [{ watched: true }] : [],
                    notes: episodeUserNotes[ep.id] || [],
                  })),
              })),
            ratings: showUserRatings[sh.id] || [],
            notes: showUserNotes[sh.id] || [],
          }))

          // Build movie list
          const whereSqlM = searchQuery ? `WHERE m.title ILIKE $1` : ''
          const paramsM = searchQuery ? [`%${searchQuery}%`] : []
          const orderSqlM = sortBy === 'title' ? `ORDER BY m.title ASC` : sortBy === 'releaseDate' ? `ORDER BY m.release_date ASC NULLS LAST` : `ORDER BY m."order" ASC NULLS LAST`
          const { rows: movies } = await query<{ id: string; title: string; order: number | null; release_date: string | null; artwork_url: string | null; imdb_rating: number | null; avg_rating: number | null }>(
            `SELECT m.id, m.title, m."order", m.release_date, m.artwork_url, m.imdb_rating,
                    (SELECT AVG(value)::float FROM ratings r WHERE r.movie_id = m.id) AS avg_rating
             FROM movies m ${whereSqlM} ${orderSqlM}`,
            paramsM as any
          )
          const movieIdsAll = movies.map(m => m.id)
          const watchedMovieSet = new Set<string>()
          if (movieIdsAll.length) {
            const { rows: wp } = await query<{ movie_id: string }>(
              `SELECT movie_id FROM watch_progress WHERE movie_id = ANY($1::uuid[])`,
              [movieIdsAll]
            )
            wp.forEach(r => watchedMovieSet.add(r.movie_id))
          }
          // Per-user ratings/notes for movies
          let movieUserRatings: Record<string, { userId: string; value: number }[]> = {}
          let movieUserNotes: Record<string, { userId: string }[]> = {}
          const userIdAll = session?.user.id
          if (userIdAll && movieIdsAll.length) {
            const { rows } = await query<{ movie_id: string; user_id: string; value: number }>(
              `SELECT movie_id, user_id, value FROM ratings WHERE user_id = $1 AND movie_id = ANY($2::uuid[])`,
              [userIdAll, movieIdsAll]
            )
            rows.forEach(r => { (movieUserRatings[r.movie_id] ||= []).push({ userId: r.user_id, value: r.value }) })
            const { rows: n } = await query<{ movie_id: string; user_id: string }>(
              `SELECT movie_id, user_id FROM notes WHERE user_id = $1 AND movie_id = ANY($2::uuid[])`,
              [userIdAll, movieIdsAll]
            )
            n.forEach(r => { (movieUserNotes[r.movie_id] ||= []).push({ userId: r.user_id }) })
          }

          const movieList = movies.map((m: any) => ({
            id: m.id,
            title: m.title,
            order: m.order || 0,
            releaseDate: m.release_date || undefined,
            artworkUrl: m.artwork_url || undefined,
            imdbRating: m.imdb_rating || undefined,
            aggregateRating: typeof m.avg_rating === 'number' ? m.avg_rating : undefined,
            ratings: movieUserRatings[m.id] || [],
            watchStatus: watchedMovieSet.has(m.id) ? [{ watched: true }] : [],
            notes: movieUserNotes[m.id] || [],
          }))

          content = [...showList, ...movieList]
        }

        // Sort combined results
        if (sortBy === 'title') {
          content.sort((a: any, b: any) => a.title.localeCompare(b.title))
        } else if (sortBy === 'imdbRating') {
          content.sort((a: any, b: any) => (b.imdbRating || 0) - (a.imdbRating || 0))
        } else {
          content.sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        }
        break
    }

    // Debug summary of computed fields
    try {
      const items = Array.isArray(content) ? content : []
      const topWithImdb = items.filter((i: any) => typeof i.imdbRating === 'number').length
      const topWithAgg = items.filter((i: any) => typeof i.aggregateRating === 'number').length
      let epWithImdb = 0, epWithAgg = 0
      let seasonsCount = 0, episodesCount = 0
      for (const it of items) {
        if (Array.isArray(it.seasons)) {
          for (const s of it.seasons) {
            seasonsCount++
            if (Array.isArray(s.episodes)) {
              for (const e of s.episodes) {
                episodesCount++
                if (typeof e.imdbRating === 'number') epWithImdb++
                if (typeof e.aggregateRating === 'number') epWithAgg++
              }
            }
          }
        }
      }
      console.log("/api/content: debug summary", {
        total: items.length,
        topWithImdb,
        topWithAgg,
        seasonsCount,
        episodesCount,
        epWithImdb,
        epWithAgg,
      })
      const sample = items[0]
      if (sample) {
        console.log("/api/content: sample item", {
          id: sample.id,
          type: sample.hasOwnProperty('releaseDate') ? 'movie' : 'show',
          imdbRating: sample.imdbRating,
          aggregateRating: sample.aggregateRating,
          firstSeasonImdb: sample.seasons?.[0]?.imdbRating,
          firstEpisodeImdb: sample.seasons?.[0]?.episodes?.[0]?.imdbRating,
          firstEpisodeAgg: sample.seasons?.[0]?.episodes?.[0]?.aggregateRating,
        })
      }
    } catch (e) {
      console.log("/api/content: debug log failed", e)
    }

    // Transform the data to match the expected format in the front-end
    const transformedContent = content.map((item: any) => {
      const baseItem: any = {
        id: item.id,
        title: item.title,
        type: item.hasOwnProperty('releaseDate') ? 'movie' : 'show',
        order: item.order || 0,
        watched: item.watchStatus?.some((status: any) => status.watched) || false,
        watchDate: item.watchStatus && item.watchStatus.length > 0 ? item.watchStatus[0].at : undefined,
        imdbRating: item.imdbRating || undefined,
        imagePath: item.artworkUrl || undefined,
      }

      // User note presence
      if ('notes' in item) {
        baseItem.hasUserNote = session ? (item as any).notes?.some((n: any) => n.userId === session.user.id) : false
      }

      // Calculate ratings
      // Individual rating from the current user (ratings arrays carry current user's ratings only)
      if (session && item.ratings && item.ratings.length > 0) {
        const userR = item.ratings.find((r: any) => r.userId === session.user.id)
        if (userR) baseItem.individualRating = userR.value
      }

      // Aggregate rating from precomputed avg fields if present, else fallback to averaging provided ratings
      if (typeof item.aggregateRating === 'number') {
        baseItem.aggregateRating = item.aggregateRating
      } else if (item.ratings && item.ratings.length > 0) {
        const avgRating = item.ratings.reduce((sum: number, r: any) => sum + r.value, 0) / item.ratings.length
        baseItem.aggregateRating = avgRating
      }

      // Include top-level progress when present (for shows)
      if (item.progress) {
        baseItem.progress = { total: item.progress.total || 0, watched: item.progress.watched || 0 }
      }

      // Add children for shows (seasons)
      if (baseItem.type === 'show' && 'seasons' in item) {
        baseItem.children = item.seasons.map((season: any) => {
          const seasonItem: any = {
            id: season.id,
            title: `Season ${season.number}`,
            type: 'season' as const,
            order: season.number,
            watched: season.watchStatus?.some((status: any) => status.watched) || false,
            watchDate: season.watchStatus && season.watchStatus.length > 0 ? season.watchStatus[0].at : undefined,
            imdbRating: season.imdbRating || undefined,
            imagePath: season.artworkUrl || item.artworkUrl || undefined,
          }

          if ('notes' in season) {
            seasonItem.hasUserNote = session ? (season as any).notes?.some((n: any) => n.userId === session.user.id) : false
          }

          // Season ratings: prefer precomputed aggregateRating if present
          if (typeof season.aggregateRating === 'number') {
            seasonItem.aggregateRating = season.aggregateRating
          } else if (season.ratings && season.ratings.length > 0) {
            const avgRating = season.ratings.reduce((sum: number, r: any) => sum + r.value, 0) / season.ratings.length
            seasonItem.aggregateRating = avgRating
          }
          if (session && season.ratings && season.ratings.length > 0) {
            const userR = season.ratings.find((r: any) => r.userId === session.user.id)
            if (userR) seasonItem.individualRating = userR.value
          }

          // Attach season progress when present
          if (season.progress) {
            seasonItem.progress = { total: season.progress.total || 0, watched: season.progress.watched || 0 }
          }

          // Add children for seasons (episodes)
          if ('episodes' in season) {
            seasonItem.children = season.episodes.map((episode: any) => {
              const out: any = {
                id: episode.id,
                title: episode.title,
                type: 'episode' as const,
                order: episode.episodeNumber,
                watched: episode.watchStatus?.some((status: any) => status.watched) || false,
                watchDate: episode.watchStatus && episode.watchStatus.length > 0 ? episode.watchStatus[0].at : undefined,
                imdbRating: episode.imdbRating || undefined,
                imagePath: episode.artworkUrl || season.artworkUrl || item.artworkUrl || undefined,
                hasUserNote: session ? (episode as any).notes?.some((n: any) => n.userId === session.user.id) : false,
              }
              // Prefer precomputed aggregateRating; fallback to averaging ratings
              if (typeof episode.aggregateRating === 'number') {
                out.aggregateRating = episode.aggregateRating
              } else if (episode.ratings && episode.ratings.length > 0) {
                out.aggregateRating = episode.ratings.reduce((sum: number, r: any) => sum + r.value, 0) / episode.ratings.length
              }
              // Individual rating from current user
              if (session && episode.ratings && episode.ratings.length > 0) {
                const userR = episode.ratings.find((r: any) => r.userId === session.user.id)
                if (userR) out.individualRating = userR.value
              }
              return out
            })

            // Sort episodes by order
            if (seasonItem.children) seasonItem.children.sort((a: any, b: any) => a.order - b.order)

            // Calculate episode averages for the season (aggregate and your)
            if (seasonItem.children.length > 0) {
              const validAgg = seasonItem.children
                .filter((ep: any) => typeof ep.aggregateRating === 'number')
                .map((ep: any) => ep.aggregateRating as number)
              if (validAgg.length > 0) {
                seasonItem.averageAggregateRating = validAgg.reduce((sum: number, v: number) => sum + v, 0) / validAgg.length
              }
              const validInd = seasonItem.children
                .filter((ep: any) => typeof ep.individualRating === 'number')
                .map((ep: any) => ep.individualRating as number)
              if (validInd.length > 0) {
                seasonItem.averageIndividualRating = validInd.reduce((sum: number, v: number) => sum + v, 0) / validInd.length
              }
            }
          }

          return seasonItem
        })

        // Sort seasons by order
        if (baseItem.children) baseItem.children.sort((a: any, b: any) => a.order - b.order)

        // Calculate season averages for the show (aggregate and your)
        if (baseItem.children.length > 0) {
          const aggVals = baseItem.children
            .filter((s: any) => typeof s.averageAggregateRating === 'number')
            .map((s: any) => s.averageAggregateRating as number)
          if (aggVals.length > 0) {
            baseItem.averageAggregateRating = aggVals.reduce((sum: number, v: number) => sum + v, 0) / aggVals.length
          }
          const indVals = baseItem.children
            .filter((s: any) => typeof s.averageIndividualRating === 'number')
            .map((s: any) => s.averageIndividualRating as number)
          if (indVals.length > 0) {
            baseItem.averageIndividualRating = indVals.reduce((sum: number, v: number) => sum + v, 0) / indVals.length
          }
        }
      }

      return baseItem
    })

    return NextResponse.json(transformedContent)
  } catch (error) {
    console.error('Error fetching content:', error)
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 }
    )
  }
}
