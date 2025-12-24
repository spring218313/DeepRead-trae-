import { Annotation, Highlight, UserNote, DrawingStroke, Book, BookChapter } from './types'
import { upsertUserNote as upsertUserNoteRow, deleteUserNote as deleteUserNoteRow } from './backend/services/userNotesDao'

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

const write = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value))
}

const hlKey = (bookId: string) => `dr_highlights_${bookId}`
const anKey = (bookId: string) => `dr_annotations_${bookId}`
const prKey = (bookId: string) => `dr_progress_${bookId}`
const notesKey = `dr_user_notes`
const nbDraftKey = (bookId: string) => `dr_nb_draft_${bookId}`
const nbStrokesKey = (bookId: string) => `dr_nb_strokes_${bookId}`
const chKey = (bookId: string) => `dr_chapters_${bookId}`
const chBackupKey = (bookId: string) => `dr_chapters_backup_${bookId}`
const chBackupMetaKey = (bookId: string) => `dr_chapters_backup_meta_${bookId}`
const defaultUserId = 'local'

const isSimulatedChapterTitle = (title: string) => {
  const t = title.trim()
  if (!t) return true
  return /^(page|section)\s+\d+$/i.test(t)
}

const normalizeChapters = (bookId: string, chapters: BookChapter[]): BookChapter[] => {
  const out: BookChapter[] = []
  const seen = new Set<string>()
  for (const c of chapters) {
    if (!c) continue
    const title = String(c.title ?? '').trim()
    if (isSimulatedChapterTitle(title)) {
      throw new Error('章节数据校验失败：禁止使用模拟章节名称')
    }
    const startParagraphIndex = Number(c.startParagraphIndex)
    if (!Number.isFinite(startParagraphIndex) || startParagraphIndex < 0) {
      throw new Error('章节数据校验失败：章节定位索引无效')
    }
    const id = String(c.id ?? '').trim()
    const fixedId = id || `${bookId}_${startParagraphIndex}_${title}`
    const key = `${fixedId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ id: fixedId, bookId, title, startParagraphIndex })
  }
  out.sort((a, b) => a.startParagraphIndex - b.startParagraphIndex)
  return out
}

function safeChapterId(bookId: string, startParagraphIndex: number, title: string): string {
  return `${bookId}_${startParagraphIndex}_${title}`
}

function isLikelyHeading(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (t.length > 60) return false

  if (t.length < 3) {
    return /^(序|前言|引言|后记|尾声|附录)$/.test(t)
  }

  if (/^(序|前言|引言|后记|尾声|附录)\b/.test(t)) return true
  if (/^第[\d一二三四五六七八九十百千零〇两]+[章节卷部篇回]\b/.test(t)) return true
  if (/^(chapter|part|book)\s+([0-9]+|[ivxlcdm]+)\b/i.test(t)) return true

  const punctuation = /[，。！？；:：、“”"'.·…]/.test(t)
  if (!punctuation && t.length <= 28) {
    if (/^[a-z]\d+$/i.test(t)) return false
    if (/^[a-z]{1,3}\d{1,3}$/i.test(t)) return false
    return true
  }
  return false
}

function deriveChaptersFromContent(book: Pick<Book, 'id' | 'title' | 'content'>): BookChapter[] {
  const hits: Array<{ title: string; startParagraphIndex: number }> = []
  const content = Array.isArray(book.content) ? book.content : []
  for (let i = 0; i < content.length; i++) {
    const raw = String(content[i] ?? '').trim()
    if (!raw) continue
    if (!isLikelyHeading(raw)) continue
    const title = raw.replace(/\s+/g, ' ').trim()
    if (!title) continue
    if (isSimulatedChapterTitle(title)) continue
    hits.push({ title, startParagraphIndex: i })
  }

  const chapters: BookChapter[] = []
  if (hits.length === 0) {
    const title = book.title?.trim() ? book.title.trim() : '正文'
    chapters.push({ id: safeChapterId(book.id, 0, title), bookId: book.id, title, startParagraphIndex: 0 })
    return chapters
  }

  const first = hits[0]
  if (first.startParagraphIndex !== 0) {
    chapters.push({ id: safeChapterId(book.id, 0, '正文'), bookId: book.id, title: '正文', startParagraphIndex: 0 })
  }

  for (const h of hits) {
    chapters.push({ id: safeChapterId(book.id, h.startParagraphIndex, h.title), bookId: book.id, title: h.title, startParagraphIndex: h.startParagraphIndex })
  }
  return normalizeChapters(book.id, chapters)
}

function backupChaptersIfNeeded(bookId: string, raw: unknown, reason: string): void {
  const existing = localStorage.getItem(chBackupKey(bookId))
  if (existing !== null) return
  write(chBackupKey(bookId), raw)
  write(chBackupMetaKey(bookId), { reason, at: new Date().toISOString() })
}

export const storageAdapter = {
  loadHighlights: (bookId: string): Highlight[] => read<Highlight[]>(hlKey(bookId), []),
  saveHighlight: (bookId: string, h: Highlight) => {
    const list = read<Highlight[]>(hlKey(bookId), [])
    const idx = list.findIndex(x => x.id === h.id)
    if (idx >= 0) list[idx] = h; else list.push(h)
    write(hlKey(bookId), list)
  },
  saveHighlightsBulk: (bookId: string, hs: Highlight[]) => {
    write(hlKey(bookId), hs)
  },
  updateHighlightColor: (bookId: string, id: string, color: Highlight['color']) => {
    const list = read<Highlight[]>(hlKey(bookId), [])
    write(hlKey(bookId), list.map(x => x.id === id ? { ...x, color } : x))
  },
  deleteHighlight: (bookId: string, id: string) => {
    const list = read<Highlight[]>(hlKey(bookId), [])
    write(hlKey(bookId), list.filter(x => x.id !== id))
  },
  loadAnnotations: (bookId: string): Annotation[] => read<Annotation[]>(anKey(bookId), []),
  saveAnnotationsBulk: (bookId: string, as: Annotation[]) => {
    write(anKey(bookId), as)
  },
  saveAnnotation: (bookId: string, a: Annotation) => {
    const list = read<Annotation[]>(anKey(bookId), [])
    const idx = list.findIndex(x => x.id === a.id)
    if (idx >= 0) list[idx] = a; else list.push(a)
    write(anKey(bookId), list)
  },
  updateAnnotationText: (bookId: string, id: string, text: string) => {
    const list = read<Annotation[]>(anKey(bookId), [])
    write(anKey(bookId), list.map(x => x.id === id ? { ...x, text } : x))
  },
  deleteAnnotation: (bookId: string, id: string) => {
    const list = read<Annotation[]>(anKey(bookId), [])
    write(anKey(bookId), list.filter(x => x.id !== id))
  },
  loadProgress: (bookId: string): number => read<number>(prKey(bookId), 0),
  saveProgress: (bookId: string, percent: number) => write(prKey(bookId), percent),
  listUserNotes: (): UserNote[] => read<UserNote[]>(notesKey, []),
  upsertUserNote: (note: UserNote) => {
    const list = read<UserNote[]>(notesKey, [])
    const idx = list.findIndex(x => x.id === note.id)
    if (idx >= 0) list[idx] = note; else list.unshift(note)
    write(notesKey, list)
    try {
      void upsertUserNoteRow(defaultUserId, {
        id: note.id,
        user_id: defaultUserId,
        book_id: note.bookId,
        quote: note.quote,
        thought: note.thought,
        date: note.date,
        updated_at: new Date().toISOString(),
        version: 1
      })
    } catch {}
  },
  deleteUserNote: (id: string) => {
    const list = read<UserNote[]>(notesKey, [])
    write(notesKey, list.filter(x => x.id !== id))
    try {
      void deleteUserNoteRow(defaultUserId, id)
    } catch {}
  },
  loadNotebookDraft: (bookId: string): string => read<string>(nbDraftKey(bookId), ''),
  saveNotebookDraft: (bookId: string, text: string) => write(nbDraftKey(bookId), text),
  loadNotebookStrokes: (bookId: string): DrawingStroke[] => read<DrawingStroke[]>(nbStrokesKey(bookId), []),
  saveNotebookStrokes: (bookId: string, strokes: DrawingStroke[]) => write(nbStrokesKey(bookId), strokes),
  loadChapters: (bookId: string): BookChapter[] => {
    const raw = read<BookChapter[]>(chKey(bookId), [])
    try {
      return normalizeChapters(bookId, raw)
    } catch {
      return []
    }
  },
  saveChaptersBulk: (bookId: string, chapters: BookChapter[]) => {
    const next = normalizeChapters(bookId, chapters)
    write(chKey(bookId), next)
  },
  ensureChapters: (book: Pick<Book, 'id' | 'title' | 'content'>): BookChapter[] => {
    const raw = read<unknown>(chKey(book.id), [])
    if (Array.isArray(raw)) {
      try {
        const normalized = normalizeChapters(book.id, raw as BookChapter[])
        if (normalized.length > 0) return normalized
      } catch {
        backupChaptersIfNeeded(book.id, raw, 'invalid')
      }
    }

    const derived = deriveChaptersFromContent(book)
    try {
      if (Array.isArray(raw) && raw.length > 0) {
        backupChaptersIfNeeded(book.id, raw, 'migrate')
      }
      write(chKey(book.id), derived)
    } catch {
      return derived
    }
    return derived
  },
  rollbackChapters: (bookId: string): boolean => {
    const raw = localStorage.getItem(chBackupKey(bookId))
    if (!raw) return false
    try {
      localStorage.setItem(chKey(bookId), raw)
      localStorage.removeItem(chBackupKey(bookId))
      localStorage.removeItem(chBackupMetaKey(bookId))
      return true
    } catch {
      return false
    }
  },
  deleteBookData: (bookId: string) => {
    const keys = [
      hlKey(bookId),
      anKey(bookId),
      prKey(bookId),
      nbDraftKey(bookId),
      nbStrokesKey(bookId),
      chKey(bookId),
      chBackupKey(bookId),
      chBackupMetaKey(bookId)
    ]
    keys.forEach(k => {
      try { localStorage.removeItem(k) } catch {}
    })
  },
  exportAll: (): string => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('dr_'))
    const data: Record<string, unknown> = {}
    keys.forEach(k => {
      try {
        const raw = localStorage.getItem(k)
        data[k] = raw ? JSON.parse(raw) : null
      } catch {
        data[k] = null
      }
    })
    return JSON.stringify(data)
  },
  importAll: (json: string) => {
    const data = JSON.parse(json) as Record<string, unknown>
    Object.entries(data).forEach(([k, v]) => {
      localStorage.setItem(k, JSON.stringify(v))
    })
  }
}
