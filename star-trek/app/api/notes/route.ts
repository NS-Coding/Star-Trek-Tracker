import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const contentId = searchParams.get('contentId')
  const contentType = searchParams.get('contentType')

  if (!contentId || !contentType) {
    return NextResponse.json(
      { error: 'Missing contentId or contentType' },
      { status: 400 }
    )
  }

  try {
    // Find field name based on content type
    const fieldName = `${contentType}Id`
    
    // Query notes for the specified content
    const notes = await prisma.note.findMany({
      where: {
        [fieldName]: contentId
      },
      include: {
        user: {
          select: {
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      notes: notes.map(note => ({
        id: note.id,
        username: note.user.username,
        content: note.content,
        timestamp: note.createdAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { contentId, contentType, userId, content } = await request.json()

    if (!contentId || !contentType || !userId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Determine which field to use based on content type
    const data: any = {
      userId,
      content
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

    // Check if note already exists
    const fieldName = `${contentType}Id`
    const existingNote = await prisma.note.findFirst({
      where: {
        userId,
        [fieldName]: contentId
      }
    })

    let result

    if (existingNote) {
      // Update existing note
      result = await prisma.note.update({
        where: { id: existingNote.id },
        data: { content }
      })
    } else {
      // Create new note
      result = await prisma.note.create({
        data
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error saving note:', error)
    return NextResponse.json(
      { error: 'Failed to save note' },
      { status: 500 }
    )
  }
}
