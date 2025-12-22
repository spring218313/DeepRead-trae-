import { Annotation, Highlight, UserNote, DrawingStroke } from './types'

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
  },
  deleteUserNote: (id: string) => {
    const list = read<UserNote[]>(notesKey, [])
    write(notesKey, list.filter(x => x.id !== id))
  },
  loadNotebookDraft: (bookId: string): string => read<string>(nbDraftKey(bookId), ''),
  saveNotebookDraft: (bookId: string, text: string) => write(nbDraftKey(bookId), text),
  loadNotebookStrokes: (bookId: string): DrawingStroke[] => read<DrawingStroke[]>(nbStrokesKey(bookId), []),
  saveNotebookStrokes: (bookId: string, strokes: DrawingStroke[]) => write(nbStrokesKey(bookId), strokes),
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
