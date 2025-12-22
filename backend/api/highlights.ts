import { HighlightRow, Page } from '../schemas'
import { upsertHighlights, listHighlights, updateHighlight as updateHL, deleteHighlight as deleteHL } from '../services/highlightsDao'

export interface PostHighlightsReq {
  bookId: string
  userId: string
  items: HighlightRow[]
}
export interface PostHighlightsRes {
  ok: boolean
}

export interface GetHighlightsReq {
  bookId: string
  userId: string
  cursor?: string
  paragraphIndex?: number
  limit?: number
}
export interface GetHighlightsRes extends Page<HighlightRow> {}

export interface PatchHighlightReq {
  bookId: string
  userId: string
  highlightId: string
  color?: HighlightRow['color']
  style?: HighlightRow['style']
  noteId?: string | null
  updated_at: string
  version: number
}
export interface PatchHighlightRes {
  ok: boolean
}

export interface DeleteHighlightReq {
  bookId: string
  userId: string
  highlightId: string
}
export interface DeleteHighlightRes {
  ok: boolean
}

export async function postHighlights(_req: PostHighlightsReq): Promise<PostHighlightsRes> {
  await upsertHighlights(_req.userId, _req.bookId, _req.items)
  return { ok: true }
}

export async function getHighlights(_req: GetHighlightsReq): Promise<GetHighlightsRes> {
  const items = await listHighlights(_req.userId, _req.bookId, _req.paragraphIndex, _req.limit ?? 100, _req.cursor)
  return { items }
}

export async function patchHighlight(_req: PatchHighlightReq): Promise<PatchHighlightRes> {
  await updateHL(_req.userId, _req.bookId, _req.highlightId, { color: _req.color, style: _req.style, note_id: _req.noteId ?? undefined, updated_at: _req.updated_at, version: _req.version })
  return { ok: true }
}

export async function deleteHighlight(_req: DeleteHighlightReq): Promise<DeleteHighlightRes> {
  await deleteHL(_req.userId, _req.bookId, _req.highlightId)
  return { ok: true }
}
