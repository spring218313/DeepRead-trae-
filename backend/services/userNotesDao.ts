import { createDB, now } from '../lib/db'
import { UserNoteRow } from '../schemas'

const db = createDB()

export async function listUserNotes(userId: string, limit = 100, cursor?: string): Promise<UserNoteRow[]> {
  const res = await db.query<UserNoteRow>(
    'SELECT id,user_id,book_id,quote,thought,date,updated_at,version FROM user_notes WHERE user_id=$1 ORDER BY updated_at DESC LIMIT ' + String(limit),
    [userId]
  )
  return res.rows
}

export async function upsertUserNote(userId: string, note: UserNoteRow): Promise<void> {
  await db.query(
    'INSERT INTO user_notes(id,user_id,book_id,quote,thought,date,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET quote=EXCLUDED.quote, thought=EXCLUDED.thought, date=EXCLUDED.date, updated_at=EXCLUDED.updated_at, version=EXCLUDED.version',
    [note.id, userId, note.book_id, note.quote, note.thought, note.date, note.updated_at ?? now(), note.version ?? 1]
  )
}
