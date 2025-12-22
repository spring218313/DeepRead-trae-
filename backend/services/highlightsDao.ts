import { createDB, now } from '../lib/db'
import { HighlightRow } from '../schemas'

const db = createDB()

export async function upsertHighlights(userId: string, bookId: string, items: HighlightRow[]): Promise<void> {
  for (const h of items) {
    await db.query(
      'INSERT INTO highlights(id,user_id,book_id,paragraph_index,start_offset,end_offset,color,style,note_id,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO UPDATE SET color=EXCLUDED.color,style=EXCLUDED.style,note_id=EXCLUDED.note_id,updated_at=EXCLUDED.updated_at,version=EXCLUDED.version',
      [h.id, userId, bookId, h.paragraph_index, h.start_offset, h.end_offset, h.color, h.style, h.note_id ?? null, h.updated_at ?? now(), h.version ?? 1]
    )
  }
}

export async function listHighlights(userId: string, bookId: string, paragraphIndex?: number, limit = 100, cursor?: string): Promise<HighlightRow[]> {
  const params: unknown[] = [userId, bookId]
  let sql = 'SELECT id,user_id,book_id,paragraph_index,start_offset,end_offset,color,style,note_id,updated_at,version FROM highlights WHERE user_id=$1 AND book_id=$2'
  if (typeof paragraphIndex === 'number') {
    params.push(paragraphIndex)
    sql += ' AND paragraph_index=$3'
  }
  sql += ' ORDER BY updated_at DESC LIMIT ' + String(limit)
  const res = await db.query<HighlightRow>(sql, params)
  return res.rows
}

export async function updateHighlight(userId: string, bookId: string, highlightId: string, patch: Partial<Pick<HighlightRow, 'color' | 'style' | 'note_id' | 'version'>> & { updated_at: string }): Promise<void> {
  await db.query(
    'UPDATE highlights SET color=COALESCE($1,color), style=COALESCE($2,style), note_id=$3, updated_at=$4, version=COALESCE($5,version) WHERE id=$6 AND user_id=$7 AND book_id=$8',
    [patch.color ?? null, patch.style ?? null, patch.note_id ?? null, patch.updated_at, patch.version ?? null, highlightId, userId, bookId]
  )
}

export async function deleteHighlight(userId: string, bookId: string, highlightId: string): Promise<void> {
  await db.query('DELETE FROM highlights WHERE id=$1 AND user_id=$2 AND book_id=$3', [highlightId, userId, bookId])
}
