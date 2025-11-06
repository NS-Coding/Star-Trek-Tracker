import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

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
    const fieldName = `${contentType}_id`

    const { rows: ratings } = await query<{ id: string; value: number; created_at: string; username: string; user_id: string }>(
      `SELECT r.id, ROUND(r.value::numeric, 1)::float AS value, r.created_at, u.username, r.user_id
       FROM ratings r
       JOIN users u ON r.user_id = u.id
       WHERE r.${fieldName} = $1
       ORDER BY r.created_at DESC`,
      [contentId]
    )

    // Calculate average rating
    const averageRating = ratings.length > 0 
      ? Math.round((ratings.reduce((sum: number, rating) => sum + rating.value, 0) / ratings.length) * 10) / 10
      : 0

    return NextResponse.json({
      ratings: ratings.map((rating) => ({
        id: rating.id,
        userId: rating.user_id,
        username: rating.username,
        rating: Math.round(rating.value * 10) / 10,
        date: new Date(rating.created_at).toISOString().split('T')[0]
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
    const ratingValue = Math.round(parseFloat(rating) * 10) / 10
    if (isNaN(ratingValue) || ratingValue < 0 || ratingValue > 10) {
      return NextResponse.json(
        { error: 'Invalid rating value (must be between 0 and 10)' },
        { status: 400 }
      )
    }

    // Determine which field to use based on content type
    const data: any = {
      user_id: userId,
      value: ratingValue
    }

    // Set the appropriate content ID field
    switch (contentType) {
      case 'show':
        data.show_id = contentId
        break
      case 'movie':
        data.movie_id = contentId
        break
      case 'season':
        data.season_id = contentId
        break
      case 'episode':
        data.episode_id = contentId
        break
      default:
        return NextResponse.json(
          { error: 'Invalid content type' },
          { status: 400 }
        )
    }

    // Check if rating already exists
    const fieldName = `${contentType}_id`
    const { rows: existing } = await query<{ id: string }>(
      `SELECT id FROM ratings WHERE user_id = $1 AND ${fieldName} = $2 LIMIT 1`,
      [userId, contentId]
    )

    if (existing.length) {
      const { rows } = await query(
        `UPDATE ratings SET value = $1, updated_at = now() WHERE id = $2 RETURNING id, value, updated_at`,
        [ratingValue, existing[0].id]
      )
      return NextResponse.json(rows[0])
    } else {
      const columns = Object.keys(data)
      const values = Object.values(data)
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
      const { rows } = await query(
        `INSERT INTO ratings (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id, value, created_at`,
        values
      )
      return NextResponse.json(rows[0])
    }
  } catch (error) {
    console.error('Error saving rating:', error)
    return NextResponse.json(
      { error: 'Failed to save rating' },
      { status: 500 }
    )
  }
}
