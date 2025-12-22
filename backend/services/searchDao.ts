import { createDB } from '../lib/db'

const db = createDB()

export async function searchContent(bookId: string, q: string, limit = 50, cursor?: string): Promise<{ paragraph_index: number; snippet: string }[]> {
  const res = await db.query<{ paragraph_index: number; text: string }>(
    "SELECT paragraph_index, text FROM book_content WHERE book_id=$1 AND (to_tsvector('simple', text) @@ plainto_tsquery('simple', $2) OR text ILIKE '%' || $2 || '%') ORDER BY paragraph_index ASC LIMIT " + String(limit),
    [bookId, q]
  )
  return res.rows.map(r => {
    const idx = r.text.toLowerCase().indexOf(q.toLowerCase())
    const start = Math.max(0, idx - 20)
    const end = Math.min(r.text.length, idx + q.length + 20)
    const snippet = r.text.slice(start, end)
    return { paragraph_index: r.paragraph_index, snippet }
  })
}
