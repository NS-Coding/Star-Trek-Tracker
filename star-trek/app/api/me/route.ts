import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAuthSession } from "@/lib/auth"

export async function GET() {
  const session = await getAuthSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      ratings: true,
      notes: true,
    },
  })

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Totals
  const [totalEpisodes, totalMovies, totalSeasons, totalShows] = await Promise.all([
    prisma.episode.count(),
    prisma.movie.count(),
    prisma.season.count(),
    prisma.show.count(),
  ])
  const totalEpisodesMovies = totalEpisodes + totalMovies // still used for Watched (global)
  const totalRateableContent = totalEpisodes + totalMovies + totalSeasons + totalShows
  const totalNoteableContent = totalRateableContent

  const watchedEpisodesMovies = await prisma.watchProgress.count({
    where: {
      watched: true,
      OR: [{ episodeId: { not: null } }, { movieId: { not: null } }],
    },
  })

  const ratedAllContent = await prisma.rating.count({
    where: {
      userId: user.id,
      OR: [
        { episodeId: { not: null } },
        { movieId: { not: null } },
        { seasonId: { not: null } },
        { showId: { not: null } },
      ],
    },
  })

  const notesAllContent = await prisma.note.count({
    where: {
      userId: user.id,
      OR: [
        { episodeId: { not: null } },
        { movieId: { not: null } },
        { seasonId: { not: null } },
        { showId: { not: null } },
      ],
    },
  })

  const ratingsCount = user.ratings.length
  const averageRating = ratingsCount === 0
    ? 0
    : user.ratings.reduce((sum, r) => sum + r.value, 0) / ratingsCount

  // Favorites = top 5 highest ratings
  const favorites = await prisma.rating.findMany({
    where: { userId: user.id },
    orderBy: { value: "desc" },
    take: 5,
    include: {
      show: { select: { title: true } },
      movie: { select: { title: true } },
      season: {
        select: {
          number: true,
          show: { select: { title: true } },
        },
      },
      episode: {
        select: {
          title: true,
          season: {
            select: { show: { select: { title: true } }, number: true },
          },
        },
      },
    },
  })

  function ratingTitle(r: any) {
    if (r.show) return r.show.title
    if (r.movie) return r.movie.title
    if (r.season) return `${r.season.show.title} - Season ${r.season.number}`
    if (r.episode)
      return `${r.episode.season.show.title} S${r.episode.season.number}E: ${r.episode.title}`
    return "Unknown"
  }

  const favoritesOut = favorites.map((r) => ({
    id: r.id,
    rating: r.value,
    title: ratingTitle(r),
  }))

  // My notes latest 5
  const notes = await prisma.note.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: {
      show: { select: { title: true } },
      movie: { select: { title: true } },
      season: {
        select: { number: true, show: { select: { title: true } } },
      },
      episode: {
        select: {
          title: true,
          season: {
            select: { show: { select: { title: true } }, number: true },
          },
        },
      },
    },
  })

  function noteTitle(n: any) {
    if (n.show) return n.show.title
    if (n.movie) return n.movie.title
    if (n.season) return `${n.season.show.title} - Season ${n.season.number}`
    if (n.episode)
      return `${n.episode.season.show.title} S${n.episode.season.number}E: ${n.episode.title}`
    return "Unknown"
  }

  const notesOut = notes.map((n) => ({
    id: n.id,
    title: noteTitle(n),
    excerpt: n.content.slice(0, 120),
    updatedAt: n.updatedAt,
  }))

  // Recent activity: merge ratings & notes latest 10
  const activity = [...favorites, ...notes]
    .sort((a: any, b: any) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    .slice(0, 10)
    .map((a: any) => ({
      type: a.value ? "rating" : "note",
      title: a.value ? ratingTitle(a) : noteTitle(a),
      value: a.value ?? undefined,
      timestamp: (a.updatedAt || a.createdAt).toISOString(),
    }))

  return NextResponse.json({
    id: user.id,
    username: user.username,
    email: user.email,
    joinDate: user.createdAt,
    isAdmin: user.isAdmin,
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
