import { describe, expect, it, vi } from 'vitest'
import { importBookFromFile, listImportedBooks } from './bookImport'

vi.mock('pdfjs-dist', () => {
  return {
    GlobalWorkerOptions: {},
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: 2,
        getPage: async (n: number) => ({
          getTextContent: async () => ({
            items: [{ str: `Page ${n} hello` }]
          })
        })
      })
    })
  }
})

vi.mock('pdfjs-dist/build/pdf.worker?worker', () => {
  return {
    default: function WorkerCtor() {
      return {}
    }
  }
})

vi.mock('epubjs', () => {
  const ePub = () => {
    const spineItems = [
      {
        load: async () => ({
          documentElement: { textContent: 'Chapter 1 content' }
        }),
        unload: () => {}
      }
    ]
    return {
      ready: Promise.resolve(),
      spine: { spineItems },
      load: async () => {}
    }
  }
  return { default: ePub }
})

describe('book import', () => {
  it('imports TXT and persists to IndexedDB', async () => {
    const file = new File(['Hello\n\nWorld'], 'ImportedBook.txt', { type: 'text/plain' })
    const progress = vi.fn()
    const book = await importBookFromFile(file, progress)
    expect(book.title).toBe('ImportedBook')
    expect(book.content.length).toBeGreaterThan(0)

    const list = await listImportedBooks()
    expect(list.some(b => b.id === book.id)).toBe(true)
  })

  it('rejects unsupported format', async () => {
    const file = new File(['data'], 'a.bin', { type: 'application/octet-stream' })
    await expect(importBookFromFile(file, () => {})).rejects.toThrow(/不支持/)
  })

  it('imports PDF via mocked parser', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.pdf', { type: 'application/pdf' })
    const book = await importBookFromFile(file, () => {})
    expect(book.content.join(' ')).toMatch(/Page 1/)
  })

  it('imports EPUB via mocked parser', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.epub', { type: 'application/epub+zip' })
    const book = await importBookFromFile(file, () => {})
    expect(book.content.join(' ')).toMatch(/Chapter 1/)
  })
})

