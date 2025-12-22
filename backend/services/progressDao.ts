import { createDB, now } from '../lib/db'

const db = createDB()

export async function saveProgress(userId: string, bookId: string, percent: number): Promise<void> {
  await db.query(
    'INSERT INTO progress(user_id,book_id,percent,updated_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
    [userId, bookId, percent, now()]
  )
}
