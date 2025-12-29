import { Book, Folder } from './types'
import { storageAdapter } from './storageAdapter'
import i18n from './i18n'

type ImportFormat = 'txt' | 'pdf' | 'epub'

export type ImportProgress = {
  phase: 'select' | 'validate' | 'read' | 'parse' | 'store' | 'done'
  percent: number
  message?: string
}

const IDB_NAME = 'deepread_local'
const IDB_VERSION = 2
const BOOK_STORE = 'books'
const FOLDER_STORE = 'folders'

const gradients = [
  'bg-gradient-to-br from-blue-400 to-cyan-300 backdrop-blur-md',
  'bg-gradient-to-br from-amber-400 to-orange-300 backdrop-blur-md',
  'bg-gradient-to-br from-fuchsia-400 to-pink-300 backdrop-blur-md',
  'bg-gradient-to-br from-emerald-400 to-lime-300 backdrop-blur-md',
  'bg-gradient-to-br from-indigo-400 to-sky-300 backdrop-blur-md',
  'bg-gradient-to-br from-rose-400 to-red-300 backdrop-blur-md'
]

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

function pickCoverColor(title: string): string {
  const idx = hashString(title) % gradients.length
  return gradients[idx] ?? gradients[0]
}

function safeId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  return `book_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function openBooksDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(BOOK_STORE)) {
        db.createObjectStore(BOOK_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(FOLDER_STORE)) {
        db.createObjectStore(FOLDER_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'))
  })
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openBooksDB()
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const req = run(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
    tx.oncomplete = () => db.close()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
  })
}

async function idbPutBook(book: Book): Promise<void> {
  await withStore(BOOK_STORE, 'readwrite', (store) => store.put(book) as unknown as IDBRequest<void>)
}

async function idbGetAllBooks(): Promise<Book[]> {
  const res = await withStore(BOOK_STORE, 'readonly', (store) => store.getAll() as unknown as IDBRequest<Book[]>)
  return Array.isArray(res) ? res : []
}

async function idbGetBook(bookId: string): Promise<Book | null> {
  const res = await withStore(BOOK_STORE, 'readonly', (store) => store.get(bookId) as unknown as IDBRequest<Book | undefined>)
  return res ? (res as Book) : null
}

async function idbDeleteBook(bookId: string): Promise<void> {
  await withStore(BOOK_STORE, 'readwrite', (store) => store.delete(bookId) as unknown as IDBRequest<void>)
}

async function idbPutFolder(folder: Folder): Promise<void> {
  await withStore(FOLDER_STORE, 'readwrite', (store) => store.put(folder) as unknown as IDBRequest<void>)
}

async function idbGetFolder(folderId: string): Promise<Folder | null> {
  const res = await withStore(FOLDER_STORE, 'readonly', (store) => store.get(folderId) as unknown as IDBRequest<Folder | undefined>)
  return res ? (res as Folder) : null
}

async function idbDeleteFolder(folderId: string): Promise<void> {
  await withStore(FOLDER_STORE, 'readwrite', (store) => store.delete(folderId) as unknown as IDBRequest<void>)
}

async function idbGetAllFolders(): Promise<Folder[]> {
  const res = await withStore(FOLDER_STORE, 'readonly', (store) => store.getAll() as unknown as IDBRequest<Folder[]>)
  return Array.isArray(res) ? res : []
}

function detectFormat(file: File): ImportFormat | null {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt') || file.type === 'text/plain') return 'txt'
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf'
  if (name.endsWith('.epub') || file.type === 'application/epub+zip') return 'epub'
  return null
}

function ensureNonEmptyParagraphs(paragraphs: string[]): string[] {
  return paragraphs.map(s => s.trim()).filter(Boolean)
}

function readFileText(file: Blob): Promise<string> {
  const f: any = file
  if (typeof f?.text === 'function') return f.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file as text'))
    reader.readAsText(file)
  })
}

function readFileArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  const f: any = file
  if (typeof f?.arrayBuffer === 'function') return f.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result instanceof ArrayBuffer ? reader.result : new ArrayBuffer(0))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file as arrayBuffer'))
    reader.readAsArrayBuffer(file)
  })
}

async function validateEpub(file: File): Promise<void> {
  const name = file.name.toLowerCase()
  const isExt = name.endsWith('.epub')
  const isMime = file.type === 'application/epub+zip' || file.type === 'application/octet-stream' || file.type === ''
  if (!isExt && !isMime) {
    throw new Error(i18n.t('import.error_epub_format'))
  }
  const head = await readFileArrayBuffer(file.slice(0, 4))
  const u8 = new Uint8Array(head)
  const isZip = u8[0] === 0x50 && u8[1] === 0x4b
  if (!isZip) {
    throw new Error(i18n.t('import.error_epub_zip'))
  }
}

function htmlToText(input: unknown): string {
  if (!input) return ''
  if (typeof input === 'string') {
    return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const doc = input as any
  const text = (doc?.body?.textContent ?? doc?.documentElement?.textContent ?? '').toString()
  return text.replace(/\s+/g, ' ').trim()
}

async function parseTxt(file: File, onProgress: (p: ImportProgress) => void): Promise<string[]> {
  onProgress({ phase: 'read', percent: 10, message: i18n.t('import.read_txt') })
  const text = await readFileText(file)
  onProgress({ phase: 'parse', percent: 40, message: i18n.t('import.parse_txt') })
  const blocks = text.split(/\r?\n\s*\r?\n/g)
  const paras = ensureNonEmptyParagraphs(blocks.length > 1 ? blocks : text.split(/\r?\n/g))
  onProgress({ phase: 'parse', percent: 70, message: i18n.t('import.clean_paras') })
  return paras.length ? paras : ['']
}

async function parsePdf(file: File, onProgress: (p: ImportProgress) => void): Promise<string[]> {
  onProgress({ phase: 'read', percent: 10, message: i18n.t('import.read_pdf') })
  const data = await readFileArrayBuffer(file)
  onProgress({ phase: 'parse', percent: 25, message: i18n.t('import.parse_pdf') })

  const pdfjs = await import('pdfjs-dist')
  const workerModule = await import('pdfjs-dist/build/pdf.worker?worker')
  const WorkerCtor = (workerModule as any).default
  if (WorkerCtor) {
    const worker = new WorkerCtor()
    ;(pdfjs as any).GlobalWorkerOptions.workerPort = worker
  }

  const doc = await (pdfjs as any).getDocument({ data }).promise
  const pages: string[] = []
  const total = doc.numPages || 1
  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = (textContent.items ?? [])
      .map((it: any) => typeof it?.str === 'string' ? it.str : '')
      .filter(Boolean)
      .join(' ')
    pages.push(pageText.trim())
    const percent = 25 + Math.round((i / total) * 55)
    onProgress({ phase: 'parse', percent, message: i18n.t('import.parse_pdf_progress', { current: i, total }) })
  }
  return ensureNonEmptyParagraphs(pages)
}

async function parseEpub(file: File, onProgress: (p: ImportProgress) => void): Promise<string[]> {
  try {
    onProgress({ phase: 'read', percent: 10, message: i18n.t('import.read_epub') })
    await validateEpub(file)
    const data = await readFileArrayBuffer(file)
    onProgress({ phase: 'parse', percent: 25, message: i18n.t('import.parse_epub') })

    const epubjs = await import('epubjs')
    const ePub = (epubjs as any).default ?? epubjs
    let book: any
    try {
      book = typeof ePub === 'function' ? ePub(data) : ePub
    } catch {
      book = typeof ePub === 'function' ? ePub() : ePub
      if (typeof book?.open === 'function') {
        book.open(data, 'binary')
      } else {
        throw new Error(i18n.t('import.error_epub_init'))
      }
    }
    await book.ready

    const spineItems = book.spine?.spineItems ?? book.spine?.items ?? []
    const total = spineItems.length || 1
    const out: string[] = []

    for (let i = 0; i < spineItems.length; i++) {
      const item = spineItems[i]
      let doc: any = null
      try {
        doc = await item.load(book.load.bind(book))
      } catch (e) {
        try {
          doc = await item.load(book.load)
        } catch {
          throw e instanceof Error ? e : new Error(i18n.t('import.error_epub_chapter'))
        }
      }
      const text = htmlToText(doc)
      if (text) out.push(text)
      try { item.unload() } catch {}
      const percent = 25 + Math.round(((i + 1) / total) * 55)
      onProgress({ phase: 'parse', percent, message: i18n.t('import.parse_epub_progress', { current: i + 1, total }) })
    }

    const paras = ensureNonEmptyParagraphs(out)
    if (!paras.length) throw new Error(i18n.t('import.error_epub_content'))
    return paras
  } catch (e) {
    const msg = e instanceof Error ? e.message : i18n.t('common.unknown_error')
    throw new Error(i18n.t('import.error_epub_fail', { message: msg }))
  }
}

function readImportedBooksFromWebStorage(): Book[] {
  if (!('localStorage' in globalThis)) return []
  const idxRaw = localStorage.getItem('dr_imported_books_index')
  const idx = idxRaw ? (JSON.parse(idxRaw) as string[]) : []
  const out: Book[] = []
  for (const id of idx) {
    const raw = localStorage.getItem(`dr_imported_book_${id}`)
    if (!raw) continue
    try {
      out.push(JSON.parse(raw) as Book)
    } catch {
      continue
    }
  }
  return out
}

function writeImportedBookToWebStorage(book: Book): void {
  if (!('localStorage' in globalThis)) return
  // Only store metadata in localStorage to avoid quota limits
  const { content, ...metadata } = book
  const raw = JSON.stringify(metadata)
  try {
    localStorage.setItem(`dr_imported_book_${book.id}`, raw)
    const idxRaw = localStorage.getItem('dr_imported_books_index')
    const idx = idxRaw ? (JSON.parse(idxRaw) as string[]) : []
    if (!idx.includes(book.id)) idx.unshift(book.id)
    localStorage.setItem('dr_imported_books_index', JSON.stringify(idx))
  } catch (e) {
    console.warn('Failed to save book metadata to localStorage:', e)
  }
}

export async function importBookFromFile(
  file: File,
  onProgress: (p: ImportProgress) => void,
  folderId?: string | null
): Promise<Book> {
  onProgress({ phase: 'validate', percent: 5, message: i18n.t('import.validate_format') })
  const fmt = detectFormat(file)
  if (!fmt) {
    throw new Error(i18n.t('import.error_invalid_format'))
  }

  const title = file.name.replace(/\.(epub|pdf|txt)$/i, '')
  let content: string[] = []

  if (fmt === 'txt') content = await parseTxt(file, onProgress)
  if (fmt === 'pdf') content = await parsePdf(file, onProgress)
  if (fmt === 'epub') content = await parseEpub(file, onProgress)

  onProgress({ phase: 'store', percent: 90, message: i18n.t('import.store_local') })
  const book: Book = {
    id: safeId(),
    title: title || i18n.t('common.untitled'),
    author: fmt.toUpperCase(),
    coverColor: pickCoverColor(title || file.name),
    folderId: folderId ?? null,
    progress: 0,
    totalParams: content.length,
    content
  }

  // Always prioritize IndexedDB for the full book data
  try {
    await idbPutBook(book)
  } catch (e) {
    console.error('Failed to save book to IndexedDB:', e)
  }

  // Save only metadata to localStorage as fallback/index
  writeImportedBookToWebStorage(book)
  
  try {
    storageAdapter.ensureChapters(book)
  } catch {}

  onProgress({ phase: 'done', percent: 100, message: i18n.t('import.import_done') })
  return book
}

export async function upsertImportedBook(next: Book): Promise<void> {
  try {
    await idbPutBook(next)
  } catch (e) {
    console.error('Failed to upsert book to IndexedDB:', e)
  }
  writeImportedBookToWebStorage(next)
  const event = new Event('deepread-imported')
  window.dispatchEvent(event)
}

export async function patchImportedBook(bookId: string, patch: Partial<Book>): Promise<Book | null> {
  let current: Book | null = null
  try {
    current = await idbGetBook(bookId)
  } catch {
    current = null
  }
  
  if (!current && 'localStorage' in globalThis) {
    const raw = localStorage.getItem(`dr_imported_book_${bookId}`)
    if (raw) {
      try {
        current = JSON.parse(raw) as Book
        // If loaded from localStorage, it might be missing content.
        // We should try to find it in IDB if it's missing.
      } catch {}
    }
  }
  
  if (!current) return null
  const merged: Book = { ...current, ...patch, id: current.id }
  await upsertImportedBook(merged)
  return merged
}

export async function deleteImportedBook(bookId: string): Promise<void> {
  try {
    await idbDeleteBook(bookId)
  } catch {}
  if ('localStorage' in globalThis) {
    const idxRaw = localStorage.getItem('dr_imported_books_index')
    const idx = idxRaw ? (JSON.parse(idxRaw) as string[]) : []
    localStorage.setItem('dr_imported_books_index', JSON.stringify(idx.filter(x => x !== bookId)))
    localStorage.removeItem(`dr_imported_book_${bookId}`)
  }
  const event = new Event('deepread-imported')
  window.dispatchEvent(event)
}

export async function listFolders(): Promise<Folder[]> {
  try {
    const rows = await idbGetAllFolders()
    return rows
  } catch {
    if (!('localStorage' in globalThis)) return []
    const raw = localStorage.getItem('dr_folders')
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as Folder[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
}

export async function createFolder(name: string, parentId?: string | null): Promise<Folder> {
  const folder: Folder = {
    id: safeId(),
    name: name.trim() || i18n.t('common.untitled'),
    parentId: parentId ?? null,
    createdAt: new Date().toISOString()
  }
  try {
    await idbPutFolder(folder)
  } catch {
    if ('localStorage' in globalThis) {
      const raw = localStorage.getItem('dr_folders')
      const list = raw ? (JSON.parse(raw) as Folder[]) : []
      const next = Array.isArray(list) ? [folder, ...list] : [folder]
      localStorage.setItem('dr_folders', JSON.stringify(next))
    }
  }
  const event = new Event('deepread-imported')
  window.dispatchEvent(event)
  return folder
}

export async function renameFolder(folderId: string, name: string): Promise<void> {
  try {
    const folder = await idbGetFolder(folderId)
    if (folder) {
      folder.name = name.trim() || i18n.t('common.untitled')
      await idbPutFolder(folder)
    }
  } catch {}
  
  if ('localStorage' in globalThis) {
    const raw = localStorage.getItem('dr_folders')
    if (raw) {
      const list = JSON.parse(raw) as Folder[]
      const next = list.map(f => f.id === folderId ? { ...f, name: name.trim() || i18n.t('common.untitled') } : f)
      localStorage.setItem('dr_folders', JSON.stringify(next))
    }
  }
  
  const event = new Event('deepread-imported')
  window.dispatchEvent(event)
}

export async function deleteFolder(folderId: string): Promise<void> {
  try {
    await idbDeleteFolder(folderId)
  } catch {}
  if ('localStorage' in globalThis) {
    const raw = localStorage.getItem('dr_folders')
    if (raw) {
      const list = JSON.parse(raw) as Folder[]
      const next = list.filter(f => f.id !== folderId)
      localStorage.setItem('dr_folders', JSON.stringify(next))
    }
  }

  // Move books in this folder to Inbox
  const books = await listImportedBooks()
  for (const b of books) {
    if (b.folderId === folderId) {
      await patchImportedBook(b.id, { folderId: null })
    }
  }

  const event = new Event('deepread-imported')
  window.dispatchEvent(event)
}

export async function listImportedBooks(): Promise<Book[]> {
  const local = readImportedBooksFromWebStorage()
  try {
    const remote = await idbGetAllBooks()
    const map = new Map<string, Book>()
    
    // Prioritize IndexedDB (remote) over localStorage (local)
    // local version might only have metadata, remote has full content
    local.forEach(b => map.set(b.id, b))
    remote.forEach(b => {
      const existing = map.get(b.id)
      if (existing) {
        // Merge IndexedDB content into local metadata if needed, 
        // but usually IndexedDB should be the source of truth
        map.set(b.id, { ...existing, ...b })
      } else {
        map.set(b.id, b)
      }
    })
    
    // Migration: If a book is only in localStorage, try to move it to IDB
    for (const b of local) {
      if (!remote.find(r => r.id === b.id) && b.content && b.content.length > 0) {
        try {
          await idbPutBook(b)
          console.log(`Migrated book ${b.id} to IndexedDB`)
        } catch (e) {
          console.warn(`Failed to migrate book ${b.id} to IndexedDB`, e)
        }
      }
    }

    return Array.from(map.values())
  } catch (e) {
    console.error('Failed to list books from IndexedDB, falling back to localStorage:', e)
    return local
  }
}

