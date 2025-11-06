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

    const { rows: notes } = await query<{ id: string; content: string; created_at: string; username: string; user_id: string }>(
      `SELECT n.id, n.content, n.created_at, u.username, n.user_id
       FROM notes n
       JOIN users u ON n.user_id = u.id
       WHERE n.${fieldName} = $1
       ORDER BY n.created_at DESC`,
      [contentId]
    )

    return NextResponse.json({
      notes: notes.map((note) => ({
        id: note.id,
        userId: note.user_id,
        username: note.username,
        content: note.content,
        timestamp: new Date(note.created_at).toISOString(),
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
      user_id: userId,
      content
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

    // Check if note already exists
    const fieldName = `${contentType}_id`
    const { rows: existing } = await query<{ id: string }>(
      `SELECT id FROM notes WHERE user_id = $1 AND ${fieldName} = $2 LIMIT 1`,
      [userId, contentId]
    )

    if (existing.length) {
      const { rows } = await query(
        `UPDATE notes SET content = $1, updated_at = now() WHERE id = $2 RETURNING id, content, updated_at`,
        [content, existing[0].id]
      )
      return NextResponse.json(rows[0])
    } else {
      const columns = Object.keys(data)
      const values = Object.values(data)
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
      const { rows } = await query(
        `INSERT INTO notes (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id, content, created_at`,
        values
      )
      return NextResponse.json(rows[0])
    }
  } catch (error) {
    console.error('Error saving note:', error)
    return NextResponse.json(
      { error: 'Failed to save note' },
      { status: 500 }
    )
  }
}
