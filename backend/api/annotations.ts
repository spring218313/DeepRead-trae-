import { AnnotationRow, Page } from '../schemas'
import { insertAnnotation, updateAnnotation as updateAnno, deleteAnnotation as deleteAnno, listAnnotations } from '../services/annotationsDao'

export interface PostAnnotationReq {
  userId: string
  bookId: string
  item: AnnotationRow
}
export interface PostAnnotationRes {
  ok: boolean
}

export interface PatchAnnotationReq {
  userId: string
  bookId: string
  annotationId: string
  text?: string
  top?: number
  point_x?: number
  color?: string
  updated_at: string
  version: number
}
export interface PatchAnnotationRes {
  ok: boolean
}

export interface DeleteAnnotationReq {
  userId: string
  bookId: string
  annotationId: string
}
export interface DeleteAnnotationRes {
  ok: boolean
}

export interface GetAnnotationsReq {
  userId: string
  bookId: string
  cursor?: string
  limit?: number
}
export interface GetAnnotationsRes extends Page<AnnotationRow> {}

export async function postAnnotation(_req: PostAnnotationReq): Promise<PostAnnotationRes> {
  await insertAnnotation(_req.userId, _req.bookId, _req.item)
  return { ok: true }
}

export async function patchAnnotation(_req: PatchAnnotationReq): Promise<PatchAnnotationRes> {
  await updateAnno(_req.userId, _req.bookId, _req.annotationId, { text: _req.text, top: _req.top, point_x: _req.point_x, color: _req.color, updated_at: _req.updated_at, version: _req.version })
  return { ok: true }
}

export async function deleteAnnotation(_req: DeleteAnnotationReq): Promise<DeleteAnnotationRes> {
  await deleteAnno(_req.userId, _req.bookId, _req.annotationId)
  return { ok: true }
}

export async function getAnnotations(_req: GetAnnotationsReq): Promise<GetAnnotationsRes> {
  const items = await listAnnotations(_req.userId, _req.bookId, _req.limit ?? 100, _req.cursor)
  return { items }
}
