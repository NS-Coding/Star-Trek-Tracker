import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { contentId, contentType, watched } = await request.json()

    if (!contentId || !contentType || watched === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Determine which field to use based on content type (exclude 'watched' here to avoid duplicate column in INSERT)
    const data: any = {}

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

    // Check if watch status already exists
    const fieldName = `${contentType}_id`
    const { rows: existingRows } = await query<{ id: string }>(
      `SELECT id FROM watch_progress WHERE ${fieldName} = $1 LIMIT 1`,
      [contentId]
    )
    const existingStatus = existingRows[0]

    let result

    if (watched === false) {
      // Unwatching: remove existing status to clear watch date
      if (existingStatus) {
        await query(`DELETE FROM watch_progress WHERE id = $1`, [existingStatus.id])
      }
      result = { success: true, watched: false }
    } else {
      // Watching: ensure a record exists and set date to now
      if (existingStatus) {
        const { rows } = await query(
          `UPDATE watch_progress SET watched = true, updated_at = now() WHERE id = $1 RETURNING id, watched, updated_at`,
          [existingStatus.id]
        )
        result = rows[0]
      } else {
        const columns = Object.keys(data).concat(['watched'])
        const values = Object.values(data).concat([true])
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
        const { rows } = await query(
          `INSERT INTO watch_progress (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id, watched, created_at`,
          values
        )
        result = rows[0]
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
