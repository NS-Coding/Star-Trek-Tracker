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
    
    // Query ratings for the specified content
    const ratings = await prisma.rating.findMany({
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

    // Calculate average rating
    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, rating) => sum + rating.value, 0) / ratings.length 
      : 0

    return NextResponse.json({
      ratings: ratings.map(rating => ({
        id: rating.id,
        username: rating.user.username,
        rating: rating.value,
        date: rating.createdAt.toISOString().split('T')[0]
      })),
      averageRating
    })
  } catch (error) {
    console.error('Error fetching ratings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ratings' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { contentId, contentType, userId, rating } = await request.json()

    if (!contentId || !contentType || !userId || rating === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate rating value
    const ratingValue = parseFloat(rating)
    if (isNaN(ratingValue) || ratingValue < 0 || ratingValue > 10) {
      return NextResponse.json(
        { error: 'Invalid rating value (must be between 0 and 10)' },
        { status: 400 }
      )
    }

    // Determine which field to use based on content type
    const data: any = {
      userId,
      value: ratingValue
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

    // Check if rating already exists
    const fieldName = `${contentType}Id`
    const existingRating = await prisma.rating.findFirst({
      where: {
        userId,
        [fieldName]: contentId
      }
    })

    let result

    if (existingRating) {
      // Update existing rating
      result = await prisma.rating.update({
        where: { id: existingRating.id },
        data: { value: ratingValue }
      })
    } else {
      // Create new rating
      result = await prisma.rating.create({
        data
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error saving rating:', error)
    return NextResponse.json(
      { error: 'Failed to save rating' },
      { status: 500 }
    )
  }
}
