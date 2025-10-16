import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

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

  const whereUser = includeOthers ? {} : { userId }

  // Build where for selected content, including episodes under selected seasons/shows
  const whereSelected = {
    OR: [
      { showId: { in: selectedIds } },
      { seasonId: { in: selectedIds } },
      { movieId: { in: selectedIds } },
      { episode: { season: { showId: { in: selectedIds } } } },
      { episode: { seasonId: { in: selectedIds } } },
    ],
  }

  const notes = await prisma.note.findMany({
    where: { ...whereUser, ...whereSelected },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: { select: { username: true } },
      show: { select: { id: true, title: true, order: true } },
      season: { select: { id: true, number: true, show: { select: { id: true, title: true, order: true } } } },
      episode: { select: { id: true, title: true, episodeNumber: true, season: { select: { number: true, show: { select: { id: true, title: true, order: true } } } } } },
      movie: { select: { id: true, title: true, order: true } },
    },
  })

  const mapped = notes.map((n) => {
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
    if (n.episode) {
      contentId = n.episode.id
      contentType = "episode"
      contentTitle = `${n.episode.season.show.title} S${n.episode.season.number}: ${n.episode.title}`
      sort = {
        typeRank: 0,
        showOrder: n.episode.season.show.order ?? 9999,
        seasonNum: n.episode.season.number,
        episodeNum: n.episode.episodeNumber,
        movieOrder: 9999,
      }
    } else if (n.season) {
      contentId = n.season.id
      contentType = "season"
      contentTitle = `${n.season.show.title} S${n.season.number}`
      sort = {
        typeRank: 0,
        showOrder: n.season.show.order ?? 9999,
        seasonNum: n.season.number,
        episodeNum: 0,
        movieOrder: 9999,
      }
    } else if (n.show) {
      contentId = n.show.id
      contentType = "show"
      contentTitle = n.show.title
      sort = {
        typeRank: 0,
        showOrder: n.show.order ?? 9999,
        seasonNum: 0,
        episodeNum: 0,
        movieOrder: 9999,
      }
    } else if (n.movie) {
      contentId = n.movie.id
      contentType = "movie"
      contentTitle = n.movie.title
      sort = {
        typeRank: 1,
        showOrder: 9999,
        seasonNum: 0,
        episodeNum: 0,
        movieOrder: n.movie.order ?? 9999,
      }
    }

    return {
      id: n.id,
      username: n.user.username,
      content: n.content,
      timestamp: n.createdAt.toISOString(),
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
