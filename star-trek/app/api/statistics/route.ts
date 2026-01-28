import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// Filters: scope: all|series|movies|show:<uuid>
// timeRange: all|week|month|year (based on created/updated timestamps)
// users: current|all|<uuid>[] (if array of user ids)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as {
    scope?: string
    timeRange?: 'all'|'week'|'month'|'year'
    users?: string[] | 'current' | 'all'
  }

  const scope = body.scope || 'all'
  const timeRange = body.timeRange || 'all'
  const users = body.users || ['current']

  // Build user filter (normalize 'current' to the authenticated user's UUID)
  const params: any[] = []
  let whereUser = ''
  if (users === 'all') {
    // no filter
  } else {
    let userIds: string[] = []
    if (Array.isArray(users)) {
      const mapped = users.map(u => (u === 'current' ? session.user.id : u)).filter(Boolean) as string[]
      userIds = mapped.length > 0 ? mapped : [session.user.id]
    } else {
      userIds = [session.user.id]
    }
    params.push(userIds)
    whereUser = 'user_id = ANY($' + params.length + '::uuid[])'
  }

  // Build time filter (using updated_at from ratings and watch_progress)
  let whereTime = ''
  if (timeRange !== 'all') {
    let interval = '1 month'
    if (timeRange === 'week') interval = '7 days'
    if (timeRange === 'month') interval = '1 month'
    if (timeRange === 'year') interval = '1 year'
    whereTime = `AND updated_at >= now() - interval '${interval}'`
  }

  // Content scope ids
  let showIds: string[] = []
  let includeMovies = true
  let includeShows = true
  if (scope === 'movies') { includeShows = false }
  else if (scope === 'series') { includeMovies = false }
  else if (scope.startsWith('show:')) {
    includeMovies = false
    const showId = scope.split(':')[1]
    if (showId) showIds = [showId]
  }

  // Fetch lookups when needed
  if (includeShows && showIds.length === 0 && (scope === 'all' || scope === 'series')) {
    const { rows } = await query<{ id: string }>('SELECT id FROM shows')
    showIds = rows.map(r => r.id)
  }

  // Average rating (per selected users and scope)
  const ratingsClauses: string[] = []
  const ratingsParams: any[] = []
  if (whereUser) ratingsClauses.push(whereUser.replace('user_id', 'user_id'))
  if (whereTime) ratingsClauses.push(whereTime.replace('AND ', ''))
  if (!includeMovies) ratingsClauses.push('(show_id IS NOT NULL OR season_id IS NOT NULL OR episode_id IS NOT NULL)')
  if (!includeShows) ratingsClauses.push('(movie_id IS NOT NULL)')
  if (includeShows && showIds.length > 0 && !(scope === 'all' || scope === 'movies')) {
    ratingsClauses.push('(show_id = ANY($' + (params.length + ratingsParams.length + 1) + '::uuid[]) OR season_id IN (SELECT id FROM seasons WHERE show_id = ANY($' + (params.length + ratingsParams.length + 1) + '::uuid[])) OR episode_id IN (SELECT e.id FROM episodes e JOIN seasons s ON s.id=e.season_id WHERE s.show_id = ANY($' + (params.length + ratingsParams.length + 1) + '::uuid[])))')
    ratingsParams.push(showIds)
  }
  const whereRatings = ratingsClauses.length ? 'WHERE ' + ratingsClauses.join(' AND ') : ''
  const avgRatingRes = await query<{ avg: number }>(`SELECT ROUND(AVG(value)::numeric, 1)::float AS avg FROM ratings ${whereRatings}`, [...params, ...ratingsParams])
  const averageRating = avgRatingRes.rows[0]?.avg || 0

  // Watch progress and runtime
  // Total possible runtime (episodes+movies)
  let totalRuntime = 0
  let watchedRuntime = 0
  let totalCount = 0
  let watchedCount = 0
  let totalEpisodes = 0
  let watchedEpisodes = 0
  let totalMovies = 0
  let watchedMovies = 0

  // Episodes in scope
  if (includeShows) {
    const epScopeFilter = showIds.length ? 'WHERE s.show_id = ANY($1::uuid[])' : ''
    const epTotal = await query<{ total_runtime: number, total_count: string }>(
      `SELECT COALESCE(SUM(e.runtime),0)::int AS total_runtime, COUNT(e.id)::text AS total_count
       FROM episodes e JOIN seasons s ON s.id = e.season_id ${epScopeFilter}`,
      showIds.length ? [showIds] : []
    )
    totalRuntime += epTotal.rows[0]?.total_runtime || 0
    const epTotalCount = parseInt(epTotal.rows[0]?.total_count || '0', 10)
    totalCount += epTotalCount
    totalEpisodes += epTotalCount

    // watched episodes runtime/count
    const userFilterWP = whereUser ? 'AND ' + whereUser.replace('user_id', 'r.user_id') : ''
    const timeFilterWP = timeRange !== 'all' ? whereTime : ''
    const watchedEp = await query<{ watched_runtime: number, watched_count: string }>(
      `SELECT COALESCE(SUM(e.runtime),0)::int AS watched_runtime, COUNT(DISTINCT e.id)::text AS watched_count
       FROM watch_progress wp
       JOIN episodes e ON e.id = wp.episode_id
       JOIN seasons s ON s.id = e.season_id
       LEFT JOIN ratings r ON r.episode_id = e.id ${userFilterWP ? '' : ''}
       WHERE wp.watched = TRUE ${showIds.length ? 'AND s.show_id = ANY($1::uuid[])' : ''} ${timeFilterWP}`,
      showIds.length ? [showIds] : []
    )
    watchedRuntime += watchedEp.rows[0]?.watched_runtime || 0
    const epWatchedCount = parseInt(watchedEp.rows[0]?.watched_count || '0', 10)
    watchedCount += epWatchedCount
    watchedEpisodes += epWatchedCount
  }

  // Movies in scope
  if (includeMovies) {
    const mvScopeFilter = '' // all movies or limited later by ids if needed
    const mvTotal = await query<{ total_runtime: number, total_count: string }>(
      `SELECT COALESCE(SUM(runtime),0)::int AS total_runtime, COUNT(id)::text AS total_count FROM movies ${mvScopeFilter}`
    )
    totalRuntime += mvTotal.rows[0]?.total_runtime || 0
    const mvCnt = parseInt(mvTotal.rows[0]?.total_count || '0', 10)
    totalCount += mvCnt
    totalMovies += mvCnt

    const timeFilterWP = timeRange !== 'all' ? whereTime : ''
    const watchedMv = await query<{ watched_runtime: number, watched_count: string }>(
      `SELECT COALESCE(SUM(m.runtime),0)::int AS watched_runtime, COUNT(DISTINCT m.id)::text AS watched_count
       FROM watch_progress wp JOIN movies m ON m.id = wp.movie_id
       WHERE wp.watched = TRUE ${timeFilterWP}`
    )
    watchedRuntime += watchedMv.rows[0]?.watched_runtime || 0
    const mvWatched = parseInt(watchedMv.rows[0]?.watched_count || '0', 10)
    watchedCount += mvWatched
    watchedMovies += mvWatched
  }

  const progressPct = totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0
  const watchTimeHours = Math.round(watchedRuntime / 60)
  const possibleHours = Math.round(totalRuntime / 60)

  // Rating distribution (1..10)
  const distRes = await query<{ rating: number, count: string }>(
    `SELECT ROUND(value::numeric, 1)::float AS rating, COUNT(*)::text AS count
     FROM ratings ${whereRatings}
     GROUP BY rating
     ORDER BY rating`
    , [...params, ...ratingsParams]
  )
  const distribution = distRes.rows.map(r => ({ rating: Number(r.rating), count: parseInt(r.count, 10) }))

  // Rating trends per episode/movie using a sortable key
  const trendRes = await query<{ ord: number, avg: number, title: string | null, is_movie: boolean }>(
    `WITH base AS (
      SELECT
        CASE
          WHEN e.id IS NOT NULL THEN (COALESCE(sh."order", 0) * 10000 + COALESCE(s.number, 0) * 100 + COALESCE(e.episode_number, 0))
          WHEN m.id IS NOT NULL THEN (COALESCE(m."order", 0) * 10000)
          ELSE NULL
        END AS ord,
        COALESCE(e.title, m.title) AS title,
        r.value,
        COALESCE(e.id::text, m.id::text) AS item_id,
        (m.id IS NOT NULL) AS is_movie
      FROM ratings r
      LEFT JOIN episodes e ON r.episode_id = e.id
      LEFT JOIN seasons s ON e.season_id = s.id
      LEFT JOIN shows sh ON s.show_id = sh.id
      LEFT JOIN movies m ON r.movie_id = m.id
    )
    SELECT ord, ROUND(AVG(value)::numeric, 1)::float AS avg, MIN(title) AS title, BOOL_OR(is_movie) AS is_movie
    FROM base
    WHERE ord IS NOT NULL
    GROUP BY ord
    ORDER BY ord`
  )
  const trend = trendRes.rows.map(r => ({ order: r.ord, rating: r.avg, title: r.title || `Order ${r.ord}` , isMovie: !!r.is_movie }))

  // User comparison per episode/movie using the same sortable key
  const userCompareRes = await query<{ username: string, ord: number, avg: number, title: string | null }>(
    `WITH r AS (
      SELECT r.user_id,
        CASE
          WHEN e.id IS NOT NULL THEN (COALESCE(sh."order", 0) * 10000 + COALESCE(s.number, 0) * 100 + COALESCE(e.episode_number, 0))
          WHEN m.id IS NOT NULL THEN (COALESCE(m."order", 0) * 10000)
          ELSE NULL
        END AS ord,
        r.value,
        COALESCE(e.title, m.title) AS title
      FROM ratings r
      LEFT JOIN episodes e ON r.episode_id = e.id
      LEFT JOIN seasons s ON e.season_id = s.id
      LEFT JOIN shows sh ON s.show_id = sh.id
      LEFT JOIN movies m ON r.movie_id = m.id
    )
    SELECT u.username, r.ord, ROUND(AVG(r.value)::numeric, 1)::float AS avg, MIN(r.title) AS title
    FROM r JOIN users u ON u.id = r.user_id
    ${whereUser ? 'WHERE ' + whereUser.replace('user_id', 'r.user_id') : ''}
    GROUP BY u.username, r.ord
    ORDER BY r.ord`
  , params)
  const userComparison = userCompareRes.rows.map(r => ({ user: r.username, order: r.ord, rating: r.avg, title: r.title || `Order ${r.ord}` }))

  // IMDb comparison series: include IMDb rating as a pseudo-user for any item that has at least one user rating
  // Build a set of orders with at least one rating (respecting the same ord definition)
  const imdbRowsRes = await query<{ ord: number; imdb: number | null; title: string | null }>(
    `WITH rated AS (
       SELECT DISTINCT
         CASE
           WHEN e.id IS NOT NULL THEN (COALESCE(sh."order", 0) * 10000 + COALESCE(s.number, 0) * 100 + COALESCE(e.episode_number, 0))
           WHEN m.id IS NOT NULL THEN (COALESCE(m."order", 0) * 10000)
           ELSE NULL
         END AS ord
       FROM ratings r
       LEFT JOIN episodes e ON r.episode_id = e.id
       LEFT JOIN seasons s ON e.season_id = s.id
       LEFT JOIN shows sh ON s.show_id = sh.id
       LEFT JOIN movies m ON r.movie_id = m.id
       WHERE r.value IS NOT NULL
     )
     , imdb_ep AS (
       SELECT
         (COALESCE(sh."order", 0) * 10000 + COALESCE(s.number, 0) * 100 + COALESCE(e.episode_number, 0)) AS ord,
         e.imdb_rating AS imdb,
         e.title AS title
       FROM episodes e
       JOIN seasons s ON e.season_id = s.id
       JOIN shows sh ON s.show_id = sh.id
     )
     , imdb_mv AS (
       SELECT
         (COALESCE(m."order", 0) * 10000) AS ord,
         m.imdb_rating AS imdb,
         m.title AS title
       FROM movies m
     )
     SELECT ord, imdb, title FROM imdb_ep WHERE imdb IS NOT NULL AND ord IN (SELECT ord FROM rated)
     UNION ALL
     SELECT ord, imdb, title FROM imdb_mv WHERE imdb IS NOT NULL AND ord IN (SELECT ord FROM rated)
     ORDER BY ord`
  )
  const imdbComparison = imdbRowsRes.rows.map(r => ({ user: 'IMDb', order: r.ord, rating: Math.round((r.imdb ?? 0) * 10) / 10, title: r.title || `Order ${r.ord}` }))

  // Combine IMDb series with user series for the User Comparison chart only
  const userComparisonAll = userComparison.concat(imdbComparison)

  // Series bands (episode ranges per show) for background shading
  let seriesBands: { title: string, start: number, end: number }[] = []
  if (includeShows) {
    const bandsRes = await query<{ title: string, start: number, finish: number }>(
      `WITH ords AS (
         SELECT sh.title,
                (COALESCE(sh."order", 0) * 10000 + COALESCE(s.number, 0) * 100 + COALESCE(e.episode_number, 0)) AS ord
         FROM episodes e
         JOIN seasons s ON s.id = e.season_id
         JOIN shows sh ON sh.id = s.show_id
       )
       SELECT title, MIN(ord) AS start, MAX(ord) AS finish
       FROM ords
       GROUP BY title
       ORDER BY MIN(ord)`
    )
    seriesBands = bandsRes.rows.map(r => ({ title: r.title, start: r.start, end: r.finish }))
  }

  // Movie order positions to mark on charts
  let movieOrders: number[] = []
  if (includeMovies) {
    const mvRes = await query<{ ord: number }>(
      `SELECT (COALESCE(m."order", 0) * 10000) AS ord FROM movies m WHERE m."order" IS NOT NULL ORDER BY ord`
    )
    movieOrders = mvRes.rows.map(r => r.ord)
  }

  // Per-user overall averages (respecting scope/time, but across all users regardless of 'users' filter)
  const userAvgRes = await query<{ username: string, avg: number }>(
    `WITH r AS (
      SELECT r.user_id, r.value,
             COALESCE(sh."order", sh2."order", m."order") AS ord
      FROM ratings r
      LEFT JOIN shows sh ON r.show_id = sh.id
      LEFT JOIN episodes e ON r.episode_id = e.id
      LEFT JOIN seasons s ON e.season_id = s.id
      LEFT JOIN shows sh2 ON s.show_id = sh2.id
      LEFT JOIN movies m ON r.movie_id = m.id
    )
    SELECT u.username, ROUND(AVG(r.value)::numeric, 1)::float AS avg
    FROM r JOIN users u ON u.id = r.user_id
    ${timeRange !== 'all' ? 'WHERE r.ord IS NOT NULL ' + whereTime : ''}
    GROUP BY u.username
    ORDER BY u.username`
  )
  const usersAverage = userAvgRes.rows.map(r => ({ user: r.username, average: r.avg }))

  // Progress by series (shows): total vs watched episodes per show
  let progressBySeries: { showId: string, title: string, total: number, watched: number }[] = []
  if (includeShows) {
    const bySeries = await query<{ id: string, title: string, total: string, watched: string }>(
      `WITH ep AS (
         SELECT e.id, s.show_id
         FROM episodes e JOIN seasons s ON s.id = e.season_id
         ${showIds.length ? 'WHERE s.show_id = ANY($1::uuid[])' : ''}
       ),
       w AS (
         SELECT DISTINCT episode_id FROM watch_progress WHERE watched = TRUE
       )
       SELECT sh.id, sh.title,
              COUNT(ep.id)::text AS total,
              COALESCE((SELECT COUNT(*) FROM w JOIN ep ON ep.id = w.episode_id AND ep.show_id = sh.id), 0)::text AS watched
       FROM shows sh
       LEFT JOIN ep ON ep.show_id = sh.id
       ${showIds.length ? 'WHERE sh.id = ANY($1::uuid[])' : ''}
       GROUP BY sh.id, sh.title
       ORDER BY sh."order" ASC NULLS LAST, sh.title ASC`,
      showIds.length ? [showIds] as any : []
    )
    progressBySeries = bySeries.rows.map(r => ({
      showId: r.id,
      title: r.title,
      total: parseInt(r.total || '0', 10),
      watched: parseInt(r.watched || '0', 10),
    }))
  }

  // User activity details (recent actions)
  const activityRes = await query<{ type: string, title: string, timestamp: string, username: string }>(
    `SELECT 'rating' AS type,
            COALESCE(sh.title, sh2.title, m.title) AS title,
            COALESCE(r.updated_at, r.created_at) AS timestamp,
            u.username
     FROM ratings r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN shows sh ON r.show_id = sh.id
     LEFT JOIN episodes e ON r.episode_id = e.id
     LEFT JOIN seasons s ON e.season_id = s.id
     LEFT JOIN shows sh2 ON s.show_id = sh2.id
     LEFT JOIN movies m ON r.movie_id = m.id
     ${whereUser ? 'WHERE ' + whereUser : ''}
     ORDER BY timestamp DESC
     LIMIT 20`
  , params)
  const activity = activityRes.rows.map(r => ({ type: r.type, title: r.title, timestamp: new Date(r.timestamp).toISOString(), user: r.username }))

  return NextResponse.json({
    summary: {
      averageRating: averageRating,
      watchTimeHours,
      possibleHours,
      watchedCount,
      totalCount,
      watchedEpisodes,
      totalEpisodes,
      watchedMovies,
      totalMovies,
      progressPct,
    },
    distribution,
    trend,
    userComparison: userComparisonAll,
    progressBySeries,
    activity,
    usersAverage,
    seriesBands,
    movieOrders,
  })
}
