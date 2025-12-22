import { Page } from '../schemas'
import { searchContent } from '../services/searchDao'

export interface SearchReq {
  userId: string
  bookId: string
  q: string
  limit?: number
  cursor?: string
}
export interface SearchItem {
  paragraph_index: number
  snippet: string
}
export interface SearchRes extends Page<SearchItem> {}

export async function search(_req: SearchReq): Promise<SearchRes> {
  const items = await searchContent(_req.bookId, _req.q, _req.limit ?? 50, _req.cursor)
  return { items }
}
