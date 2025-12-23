import { createDB } from '../lib/db'

const db = createDB()

export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const books = await db.query('SELECT id,title,author,total_params,meta FROM books WHERE owner_id=$1', [userId])
  const highlights = await db.query('SELECT * FROM highlights WHERE user_id=$1', [userId])
  const annotations = await db.query('SELECT * FROM annotations WHERE user_id=$1', [userId])
  const notes = await db.query('SELECT * FROM user_notes WHERE user_id=$1', [userId])
  const progress = await db.query('SELECT * FROM progress WHERE user_id=$1', [userId])
  const chapters = await db.query('SELECT * FROM book_chapters WHERE user_id=$1', [userId])
  const drafts = await db.query('SELECT * FROM notebook_drafts WHERE user_id=$1', [userId])
  return {
    books: books.rows,
    highlights: highlights.rows,
    annotations: annotations.rows,
    user_notes: notes.rows,
    progress: progress.rows,
    book_chapters: chapters.rows,
    notebook_drafts: drafts.rows
  }
}

export async function importUserData(userId: string, data: Record<string, unknown>): Promise<void> {
  const hs = (data['highlights'] as any[]) ?? []
  for (const h of hs) {
    await db.query(
      'INSERT INTO highlights(id,user_id,book_id,paragraph_index,start_offset,end_offset,color,style,note_id,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO UPDATE SET color=EXCLUDED.color,style=EXCLUDED.style,note_id=EXCLUDED.note_id,updated_at=EXCLUDED.updated_at,version=EXCLUDED.version',
      [h.id, userId, h.book_id, h.paragraph_index, h.start_offset, h.end_offset, h.color, h.style, h.note_id ?? null, h.updated_at, h.version]
    )
  }
  const as = (data['annotations'] as any[]) ?? []
  for (const a of as) {
    await db.query(
      'INSERT INTO annotations(id,user_id,highlight_id,text,top,point_x,color,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET text=EXCLUDED.text, top=EXCLUDED.top, point_x=EXCLUDED.point_x, color=EXCLUDED.color, updated_at=EXCLUDED.updated_at, version=EXCLUDED.version',
      [a.id, userId, a.highlight_id, a.text, a.top, a.point_x ?? null, a.color, a.updated_at, a.version]
    )
  }
  const ns = (data['user_notes'] as any[]) ?? []
  for (const n of ns) {
    await db.query(
      'INSERT INTO user_notes(id,user_id,book_id,quote,thought,date,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET quote=EXCLUDED.quote, thought=EXCLUDED.thought, date=EXCLUDED.date, updated_at=EXCLUDED.updated_at, version=EXCLUDED.version',
      [n.id, userId, n.book_id, n.quote, n.thought, n.date, n.updated_at, n.version]
    )
  }
  const ps = (data['progress'] as any[]) ?? []
  for (const p of ps) {
    await db.query(
      'INSERT INTO progress(user_id,book_id,percent,updated_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [userId, p.book_id, p.percent, p.updated_at]
    )
  }
  const cs = (data['book_chapters'] as any[]) ?? []
  for (const c of cs) {
    await db.query(
      'INSERT INTO book_chapters(id,user_id,book_id,title,start_paragraph_index,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, start_paragraph_index=EXCLUDED.start_paragraph_index, updated_at=EXCLUDED.updated_at, version=EXCLUDED.version',
      [c.id, userId, c.book_id, c.title, c.start_paragraph_index, c.updated_at, c.version ?? 1]
    )
  }
  const ds = (data['notebook_drafts'] as any[]) ?? []
  for (const d of ds) {
    await db.query(
      'INSERT INTO notebook_drafts(id,user_id,book_id,text,updated_at,version) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET text=EXCLUDED.text, updated_at=EXCLUDED.updated_at, version=EXCLUDED.version',
      [d.id, userId, d.book_id, d.text, d.updated_at, d.version ?? 1]
    )
  }
}
