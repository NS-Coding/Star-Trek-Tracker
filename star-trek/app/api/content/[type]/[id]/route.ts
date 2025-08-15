import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { type: string; id: string } }
) {
  const { type, id } = params

  try {
    let content = null
    
    switch (type) {
      case 'show':
        content = await prisma.show.findUnique({
          where: { id },
          include: {
            seasons: {
              select: {
                id: true,
                number: true,
              },
              orderBy: {
                number: 'asc',
              },
            },
            ratings: true,
            watchStatus: true,
          },
        })
        break
      
      case 'movie':
        content = await prisma.movie.findUnique({
          where: { id },
          include: {
            ratings: true,
            watchStatus: true,
          },
        })
        break
      
      case 'season':
        content = await prisma.season.findUnique({
          where: { id },
          include: {
            show: {
              select: {
                id: true,
                title: true,
                artworkUrl: true,
              },
            },
            episodes: {
              select: {
                id: true,
                title: true,
                episodeNumber: true,
              },
              orderBy: {
                episodeNumber: 'asc',
              },
            },
            ratings: true,
            watchStatus: true,
          },
        })
        break
      
      case 'episode':
        content = await prisma.episode.findUnique({
          where: { id },
          include: {
            season: {
              select: {
                id: true,
                number: true,
                show: {
                  select: {
                    id: true,
                    title: true,
                    artworkUrl: true,
                  },
                },
              },
            },
            ratings: true,
            watchStatus: true,
          },
        })
        break
      
      default:
        return NextResponse.json({ error: 'Invalid content type' }, { status: 400 })
    }

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    // Format the content with additional fields needed by the UI
    const formattedContent = {
      ...content,
      type,
      watched: content.watchStatus?.length > 0 ? content.watchStatus[0].watched : false,
      userRating: content.ratings?.length > 0 ? 
        content.ratings.reduce((sum, rating) => sum + rating.value, 0) / content.ratings.length : 
        null,
    }

    return NextResponse.json(formattedContent)
  } catch (error) {
    console.error('Error fetching content:', error)
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 })
  }
}
