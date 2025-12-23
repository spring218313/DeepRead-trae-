import { Book } from './types'
import { storageAdapter } from './storageAdapter'

type ImportFormat = 'txt' | 'pdf' | 'epub'

export type ImportProgress = {
  phase: 'select' | 'validate' | 'read' | 'parse' | 'store' | 'done'
  percent: number
  message?: string
}

const IDB_NAME = 'deepread_local'
const IDB_VERSION = 1
const BOOK_STORE = 'books'

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
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'))
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openBooksDB()
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(BOOK_STORE, mode)
    const store = tx.objectStore(BOOK_STORE)
    const req = run(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
    tx.oncomplete = () => db.close()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
  })
}

async function idbPutBook(book: Book): Promise<void> {
  await withStore('readwrite', (store) => store.put(book) as unknown as IDBRequest<void>)
}

async function idbGetAllBooks(): Promise<Book[]> {
  const res = await withStore('readonly', (store) => store.getAll() as unknown as IDBRequest<Book[]>)
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

async function parseTxt(file: File, onProgress: (p: ImportProgress) => void): Promise<string[]> {
  onProgress({ phase: 'read', percent: 10, message: '读取TXT' })
  const text = await readFileText(file)
  onProgress({ phase: 'parse', percent: 40, message: '解析TXT' })
  const blocks = text.split(/\r?\n\s*\r?\n/g)
  const paras = ensureNonEmptyParagraphs(blocks.length > 1 ? blocks : text.split(/\r?\n/g))
  onProgress({ phase: 'parse', percent: 70, message: '整理段落' })
  return paras.length ? paras : ['']
}

async function parsePdf(file: File, onProgress: (p: ImportProgress) => void): Promise<string[]> {
  onProgress({ phase: 'read', percent: 10, message: '读取PDF' })
  const data = await readFileArrayBuffer(file)
  onProgress({ phase: 'parse', percent: 25, message: '解析PDF' })

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
    onProgress({ phase: 'parse', percent, message: `解析PDF ${i}/${total}` })
  }
  return ensureNonEmptyParagraphs(pages)
}

async function parseEpub(file: File, onProgress: (p: ImportProgress) => void): Promise<string[]> {
  onProgress({ phase: 'read', percent: 10, message: '读取EPUB' })
  const data = await readFileArrayBuffer(file)
  onProgress({ phase: 'parse', percent: 25, message: '解析EPUB' })

  const epubjs = await import('epubjs')
  const ePub = (epubjs as any).default ?? epubjs
  const book = ePub(data)
  await book.ready

  const spineItems = book.spine?.spineItems ?? []
  const total = spineItems.length || 1
  const out: string[] = []

  for (let i = 0; i < spineItems.length; i++) {
    const item = spineItems[i]
    const doc = await item.load(book.load.bind(book))
    const text = (doc?.documentElement?.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (text) out.push(text)
    item.unload()
    const percent = 25 + Math.round(((i + 1) / total) * 55)
    onProgress({ phase: 'parse', percent, message: `解析EPUB ${i + 1}/${total}` })
  }

  return ensureNonEmptyParagraphs(out)
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
  const raw = JSON.stringify(book)
  localStorage.setItem(`dr_imported_book_${book.id}`, raw)
  const idxRaw = localStorage.getItem('dr_imported_books_index')
  const idx = idxRaw ? (JSON.parse(idxRaw) as string[]) : []
  if (!idx.includes(book.id)) idx.unshift(book.id)
  localStorage.setItem('dr_imported_books_index', JSON.stringify(idx))
}

export async function importBookFromFile(
  file: File,
  onProgress: (p: ImportProgress) => void
): Promise<Book> {
  onProgress({ phase: 'validate', percent: 5, message: '校验格式' })
  const fmt = detectFormat(file)
  if (!fmt) {
    throw new Error('不支持的文件格式，请选择 EPUB / PDF / TXT')
  }

  const title = file.name.replace(/\.(epub|pdf|txt)$/i, '')
  let content: string[] = []

  if (fmt === 'txt') content = await parseTxt(file, onProgress)
  if (fmt === 'pdf') content = await parsePdf(file, onProgress)
  if (fmt === 'epub') content = await parseEpub(file, onProgress)

  onProgress({ phase: 'store', percent: 90, message: '写入本地存储' })
  const book: Book = {
    id: safeId(),
    title: title || 'Untitled',
    author: fmt.toUpperCase(),
    coverColor: pickCoverColor(title || file.name),
    progress: 0,
    totalParams: content.length,
    content
  }

  try {
    await idbPutBook(book)
  } catch {}

  writeImportedBookToWebStorage(book)
  try {
    storageAdapter.ensureChapters(book)
  } catch {}

  onProgress({ phase: 'done', percent: 100, message: '导入完成' })
  return book
}

export async function listImportedBooks(): Promise<Book[]> {
  const local = readImportedBooksFromWebStorage()
  try {
    const remote = await idbGetAllBooks()
    const map = new Map<string, Book>()
    ;[...remote, ...local].forEach(b => map.set(b.id, b))
    return Array.from(map.values())
  } catch {
    return local
  }
}

