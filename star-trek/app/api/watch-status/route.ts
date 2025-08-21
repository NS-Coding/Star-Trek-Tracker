import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { contentId, contentType, watched } = await request.json()

    if (!contentId || !contentType || watched === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Determine which field to use based on content type
    const data: any = {
      watched
    }

    // Set the appropriate content ID field
    switch (contentType) {
      case 'show':
        data.showId = contentId
        break
      case 'movie':
        data.movieId = contentId
        break
      case 'season':
        data.seasonId = contentId
        break
      case 'episode':
        data.episodeId = contentId
        break
      default:
        return NextResponse.json(
          { error: 'Invalid content type' },
          { status: 400 }
        )
    }

    // Check if watch status already exists
    const fieldName = `${contentType}Id`
    const existingStatus = await prisma.watchProgress.findFirst({
      where: {
        [fieldName]: contentId
      }
    })

    let result

    if (watched === false) {
      // Unwatching: remove existing status to clear watch date
      if (existingStatus) {
        await prisma.watchProgress.delete({ where: { id: existingStatus.id } })
      }
      result = { success: true, watched: false }
    } else {
      // Watching: ensure a record exists and set date to now
      if (existingStatus) {
        result = await prisma.watchProgress.update({
          where: { id: existingStatus.id },
          data: { watched: true, createdAt: new Date() },
        })
      } else {
        result = await prisma.watchProgress.create({
          data: { ...data, watched: true }
        })
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error updating watch status:', error)
    return NextResponse.json(
      { error: 'Failed to update watch status' },
      { status: 500 }
    )
  }
}
