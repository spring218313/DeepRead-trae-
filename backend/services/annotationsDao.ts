import { createDB, now } from '../lib/db'
import { AnnotationRow } from '../schemas'

const db = createDB()

export async function insertAnnotation(userId: string, bookId: string, a: AnnotationRow): Promise<void> {
  await db.query(
    'INSERT INTO annotations(id,user_id,highlight_id,text,top,point_x,color,updated_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET text=EXCLUDED.text, top=EXCLUDED.top, point_x=EXCLUDED.point_x, color=EXCLUDED.color, updated_at=EXCLUDED.updated_at, version=EXCLUDED.version',
    [a.id, userId, a.highlight_id, a.text, a.top, a.point_x ?? null, a.color, a.updated_at ?? now(), a.version ?? 1]
  )
}

export async function updateAnnotation(userId: string, bookId: string, annotationId: string, patch: Partial<Pick<AnnotationRow, 'text' | 'top' | 'point_x' | 'color' | 'version'>> & { updated_at: string }): Promise<void> {
  await db.query(
    'UPDATE annotations SET text=COALESCE($1,text), top=COALESCE($2,top), point_x=$3, color=COALESCE($4,color), updated_at=$5, version=COALESCE($6,version) WHERE id=$7 AND user_id=$8',
    [patch.text ?? null, patch.top ?? null, patch.point_x ?? null, patch.color ?? null, patch.updated_at, patch.version ?? null, annotationId, userId]
  )
}

export async function deleteAnnotation(userId: string, bookId: string, annotationId: string): Promise<void> {
  await db.query('DELETE FROM annotations WHERE id=$1 AND user_id=$2', [annotationId, userId])
}

export async function listAnnotations(userId: string, bookId: string, limit = 100, cursor?: string): Promise<AnnotationRow[]> {
  const res = await db.query<AnnotationRow>(
    'SELECT id,user_id,highlight_id,text,top,point_x,color,updated_at,version FROM annotations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT ' + String(limit),
    [userId]
  )
  return res.rows
}
