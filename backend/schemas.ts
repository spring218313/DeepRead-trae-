export type ID = string

export interface Book {
  id: ID
  title: string
  author: string
  total_params: number
  meta?: Record<string, unknown>
  owner_id: ID
}

export interface BookContent {
  id: number
  book_id: ID
  paragraph_index: number
  text: string
}

export interface HighlightRow {
  id: ID
  user_id: ID
  book_id: ID
  paragraph_index: number
  start_offset: number
  end_offset: number
  color: 'blue' | 'yellow' | 'red' | 'purple'
  style: 'underline' | 'background'
  note_id?: ID
  updated_at: string
  version: number
}

export interface AnnotationRow {
  id: ID
  user_id: ID
  highlight_id: ID
  text: string
  top: number
  point_x?: number
  color: string
  updated_at: string
  version: number
}

export interface UserNoteRow {
  id: ID
  user_id: ID
  book_id: ID
  quote: string
  thought: string
  date: string
  updated_at: string
  version: number
}

export interface ProgressRow {
  id: number
  user_id: ID
  book_id: ID
  percent: number
  updated_at: string
}

export interface BookChapterRow {
  id: ID
  user_id: ID
  book_id: ID
  title: string
  start_paragraph_index: number
  updated_at: string
  version: number
}

export interface Page<T> {
  items: T[]
  nextCursor?: string
}
