import { createDB, now } from '../lib/db'
import { BookChapterRow } from '../schemas'

const db = createDB()

export async function upsertChapters(userId: string, bookId: string, items: BookChapterRow[]): Promise<void> {
  for (const c of items) {
    await db.query(
      'INSERT INTO book_chapters(id,user_id,book_id,title,start_paragraph_index,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, start_paragraph_index=EXCLUDED.start_paragraph_index, updated_at=EXCLUDED.updated_at, version=EXCLUDED.version',
      [c.id, userId, bookId, c.title, c.start_paragraph_index, c.updated_at ?? now(), c.version ?? 1]
    )
  }
}

export async function listChapters(userId: string, bookId: string, limit = 500): Promise<BookChapterRow[]> {
  const res = await db.query<BookChapterRow>(
    'SELECT id,user_id,book_id,title,start_paragraph_index,updated_at,version FROM book_chapters WHERE user_id=$1 AND book_id=$2 ORDER BY start_paragraph_index ASC LIMIT ' + String(limit),
    [userId, bookId]
  )
  return res.rows
}

export async function deleteChapter(userId: string, chapterId: string): Promise<void> {
  await db.query('DELETE FROM book_chapters WHERE id=$1 AND user_id=$2', [chapterId, userId])
}

