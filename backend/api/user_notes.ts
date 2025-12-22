import { Page } from '../schemas'
import { listUserNotes as listNotes, upsertUserNote as upsertNote } from '../services/userNotesDao'

export interface UserNote {
  id: string
  user_id: string
  book_id: string
  quote: string
  thought: string
  date: string
  updated_at: string
  version: number
}

export interface GetUserNotesReq {
  userId: string
  cursor?: string
  limit?: number
}
export interface GetUserNotesRes extends Page<UserNote> {}

export interface UpsertUserNoteReq {
  userId: string
  note: UserNote
}
export interface UpsertUserNoteRes {
  ok: boolean
}

export async function getUserNotes(_req: GetUserNotesReq): Promise<GetUserNotesRes> {
  const items = await listNotes(_req.userId, _req.limit ?? 100, _req.cursor)
  return { items }
}

export async function upsertUserNote(_req: UpsertUserNoteReq): Promise<UpsertUserNoteRes> {
  await upsertNote(_req.userId, _req.note)
  return { ok: true }
}
