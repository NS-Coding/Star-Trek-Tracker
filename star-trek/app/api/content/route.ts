import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthSession } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getAuthSession()
  const { searchParams } = new URL(request.url)
  const contentType = searchParams.get('type') || 'all'
  const sortBy = searchParams.get('sortBy') || 'order'
  const unwatchedOnly = searchParams.get('unwatchedOnly') === 'true'
  const searchQuery = searchParams.get('search') || ''

  try {
    let content = []

    // Handle different content types
    switch (contentType) {
      case 'show':
        content = await prisma.show.findMany({
          where: {
            ...(searchQuery ? { title: { contains: searchQuery, mode: 'insensitive' } } : {}),
            ...(unwatchedOnly ? { 
              watchStatus: {
                none: { watched: true }
              }
            } : {})
          },
          include: {
            seasons: {
              include: {
                episodes: {
                  include: {
                    ratings: true,
                    watchStatus: true
                  }
                },
                ratings: true,
                watchStatus: true
              }
            },
            ratings: true,
            watchStatus: true
          },
          orderBy: sortBy === 'title' 
            ? { title: 'asc' } 
            : sortBy === 'imdbRating' 
              ? { imdbRating: 'desc' } 
              : { order: 'asc' }
        })
        break

      case 'movie':
        content = await prisma.movie.findMany({
          where: {
            ...(searchQuery ? { title: { contains: searchQuery, mode: 'insensitive' } } : {}),
            ...(unwatchedOnly ? { 
              watchStatus: {
                none: { watched: true }
              }
            } : {})
          },
          include: {
            ratings: true,
            watchStatus: true
          },
          orderBy: sortBy === 'title' 
            ? { title: 'asc' } 
            : sortBy === 'imdbRating' 
              ? { imdbRating: 'desc' } 
              : sortBy === 'releaseDate'
                ? { releaseDate: 'asc' }
                : { order: 'asc' }
        })
        break

      case 'all':
      default:
        // Fetch both shows and movies
        const shows = await prisma.show.findMany({
          where: {
            ...(searchQuery ? { title: { contains: searchQuery, mode: 'insensitive' } } : {}),
            ...(unwatchedOnly ? { 
              watchStatus: {
                none: { watched: true }
              }
            } : {})
          },
          include: {
            seasons: {
              include: {
                episodes: {
                  include: {
                    ratings: true,
                    watchStatus: true
                  }
                },
                ratings: true,
                watchStatus: true
              }
            },
            ratings: true,
            watchStatus: true
          }
        })

        const movies = await prisma.movie.findMany({
          where: {
            ...(searchQuery ? { title: { contains: searchQuery, mode: 'insensitive' } } : {}),
            ...(unwatchedOnly ? { 
              watchStatus: {
                none: { watched: true }
              }
            } : {})
          },
          include: {
            ratings: true,
            watchStatus: true
          }
        })

        content = [...shows, ...movies]

        // Sort combined results
        if (sortBy === 'title') {
          content.sort((a, b) => a.title.localeCompare(b.title))
        } else if (sortBy === 'imdbRating') {
          content.sort((a, b) => (b.imdbRating || 0) - (a.imdbRating || 0))
        } else {
          content.sort((a, b) => (a.order || 0) - (b.order || 0))
        }
        break
    }

    // Transform the data to match the expected format in the front-end
    const transformedContent = content.map(item => {
      const baseItem: any = {
        id: item.id,
        title: item.title,
        type: item.hasOwnProperty('releaseDate') ? 'movie' : 'show',
        order: item.order || 0,
        watched: item.watchStatus?.some(status => status.watched) || false,
        imdbRating: item.imdbRating || undefined,
        imagePath: item.artworkUrl || undefined,
      }

      // Calculate ratings
      if (item.ratings && item.ratings.length > 0) {
        const avgRating = item.ratings.reduce((sum, r) => sum + r.value, 0) / item.ratings.length
        baseItem.aggregateRating = avgRating
        if (session) {
          const userR = item.ratings.find((r: any) => r.userId === session.user.id)
          if (userR) baseItem.individualRating = userR.value
        }
      }

      // Add children for shows (seasons)
      if (baseItem.type === 'show' && 'seasons' in item) {
        baseItem.children = item.seasons.map(season => {
          const seasonItem: any = {
            id: season.id,
            title: `Season ${season.number}`,
            type: 'season' as const,
            order: season.number,
            watched: season.watchStatus?.some(status => status.watched) || false,
            imdbRating: season.imdbRating || undefined,
            imagePath: season.artworkUrl || item.artworkUrl || undefined,
          }

          // Calculate ratings for season
          if (season.ratings && season.ratings.length > 0) {
            const avgRating = season.ratings.reduce((sum, r) => sum + r.value, 0) / season.ratings.length
            seasonItem.aggregateRating = avgRating
            if (session) {
              const userR = season.ratings.find((r: any) => r.userId === session.user.id)
              if (userR) seasonItem.individualRating = userR.value
            }
          }

          // Add children for seasons (episodes)
          if ('episodes' in season) {
            seasonItem.children = season.episodes.map(episode => ({
              id: episode.id,
              title: episode.title,
              type: 'episode' as const,
              order: episode.episodeNumber,
              watched: episode.watchStatus?.some(status => status.watched) || false,
              imdbRating: episode.imdbRating || undefined,
              imagePath: episode.artworkUrl || season.artworkUrl || item.artworkUrl || undefined,
              individualRating: episode.ratings && episode.ratings.length > 0
                ? episode.ratings.find((r: any) => r.userId === session?.user.id)?.value
                : undefined,
              aggregateRating: episode.ratings && episode.ratings.length > 0
                ? episode.ratings.reduce((sum, r) => sum + r.value, 0) / episode.ratings.length
                : undefined,
            }))

            // Sort episodes by order
            if (seasonItem.children) seasonItem.children.sort((a: any, b: any) => a.order - b.order)

            // Calculate average ratings from episodes
            if (seasonItem.children.length > 0) {
              const validRatings = seasonItem.children.filter((ep: any) => ep.aggregateRating !== undefined)
              if (validRatings.length > 0) {
                seasonItem.averageAggregateRating = validRatings.reduce((sum, ep) => sum + (ep.aggregateRating || 0), 0) / validRatings.length
              }
            }
          }

          return seasonItem
        })

        // Sort seasons by order
        if (baseItem.children) baseItem.children.sort((a: any, b: any) => a.order - b.order)

        // Calculate average ratings from seasons
        if (baseItem.children.length > 0) {
          const validRatings = baseItem.children.filter((s: any) => s.aggregateRating !== undefined)
          if (validRatings.length > 0) {
            baseItem.averageAggregateRating = validRatings.reduce((sum, s) => sum + (s.aggregateRating || 0), 0) / validRatings.length
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
