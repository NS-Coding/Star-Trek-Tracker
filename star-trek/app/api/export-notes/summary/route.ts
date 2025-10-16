import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const includeOthers = url.searchParams.get("includeOthers") === "1"

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  // Shows with episode progress and note counts
  const shows = await prisma.show.findMany({
    orderBy: [{ order: "asc" as const }, { title: "asc" as const }],
    select: { id: true, title: true, seasons: { select: { id: true, episodes: { select: { id: true } } } } },
  })

  // Seasons (for counts/progress only; not selectable)
  const seasons = await prisma.season.findMany({
    orderBy: [{ number: "asc" }],
    select: {
      id: true,
      number: true,
      show: { select: { id: true, title: true } },
      showId: true,
      episodes: { select: { id: true } },
    },
  })

  // Movies
  const movies = await prisma.movie.findMany({
    orderBy: [{ order: "asc" as const }, { title: "asc" as const }],
    select: { id: true, title: true },
  })

  // Notes grouped for counts
  const notesWhere = includeOthers
    ? {}
    : { userId }

  const episodeNotes = await prisma.note.findMany({
    where: { ...notesWhere, NOT: { episodeId: null } },
    select: { id: true, episode: { select: { id: true, season: { select: { id: true, showId: true } } } } },
  })

  const showNotes = await prisma.note.findMany({
    where: { ...notesWhere, NOT: { showId: null } },
    select: { id: true, showId: true },
  })

  const seasonNotes = await prisma.note.findMany({
    where: { ...notesWhere, NOT: { seasonId: null } },
    select: { id: true, season: { select: { id: true, showId: true } } },
  })

  const movieNotes = await prisma.note.findMany({
    where: { ...notesWhere, NOT: { movieId: null } },
    select: { id: true, movieId: true },
  })

  // Compute episode-level noted counts per season and show (distinct episodes)
  const notedEpisodeIdsBySeason = new Map<string, Set<string>>()
  const notedEpisodeIdsByShow = new Map<string, Set<string>>()
  for (const n of episodeNotes) {
    const seasonId = n.episode?.season.id!
    const showId = n.episode?.season.showId!
    if (!notedEpisodeIdsBySeason.has(seasonId)) notedEpisodeIdsBySeason.set(seasonId, new Set())
    notedEpisodeIdsBySeason.get(seasonId)!.add(n.episode!.id)
    if (!notedEpisodeIdsByShow.has(showId)) notedEpisodeIdsByShow.set(showId, new Set())
    notedEpisodeIdsByShow.get(showId)!.add(n.episode!.id)
  }

  // Aggregate note counts per entity
  const noteCountByShow = new Map<string, number>()
  const noteCountBySeason = new Map<string, number>()
  const noteCountByMovie = new Map<string, number>()
  for (const n of showNotes) noteCountByShow.set(n.showId!, (noteCountByShow.get(n.showId!) || 0) + 1)
  for (const n of seasonNotes) noteCountBySeason.set(n.season!.id, (noteCountBySeason.get(n.season!.id) || 0) + 1)
  for (const n of movieNotes) noteCountByMovie.set(n.movieId!, (noteCountByMovie.get(n.movieId!) || 0) + 1)

  // Include episode-notes in counts at parent levels for visibility
  for (const [seasonId, set] of notedEpisodeIdsBySeason) {
    noteCountBySeason.set(seasonId, (noteCountBySeason.get(seasonId) || 0) + set.size)
  }
  // For shows, add distinct episodes and season-level notes to total counts
  for (const show of shows) {
    const showId = show.id
    const episodeCount = notedEpisodeIdsByShow.get(showId)?.size || 0
    // add noted episodes
    noteCountByShow.set(showId, (noteCountByShow.get(showId) || 0) + episodeCount)
    // add season-level notes under this show
    const seasonsForShow = seasons.filter((s) => s.showId === showId)
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
    const totalEpisodes = sh.seasons.reduce((acc, s) => acc + s.episodes.length, 0)
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
