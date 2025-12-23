import { describe, expect, it } from 'vitest'
import { insertAnnotation, listAnnotations, updateAnnotation, deleteAnnotation } from './backend/services/annotationsDao'
import { upsertHighlights, listHighlights, deleteHighlight } from './backend/services/highlightsDao'
import { upsertUserNote, listUserNotes } from './backend/services/userNotesDao'
import { upsertChapters, listChapters, deleteChapter } from './backend/services/chaptersDao'

describe('backend local DB adapter (Web Storage)', () => {
  it('supports highlight insert/list/delete', async () => {
    await upsertHighlights('u1', 'b1', [{
      id: 'h1',
      user_id: 'u1',
      book_id: 'b1',
      paragraph_index: 0,
      start_offset: 0,
      end_offset: 5,
      color: 'yellow',
      style: 'background',
      note_id: null,
      updated_at: new Date(1).toISOString(),
      version: 1
    }])

    const list = await listHighlights('u1', 'b1')
    expect(list.some(h => h.id === 'h1')).toBe(true)

    await deleteHighlight('u1', 'b1', 'h1')
    const list2 = await listHighlights('u1', 'b1')
    expect(list2.some(h => h.id === 'h1')).toBe(false)
  })

  it('supports annotation insert/update/list/delete', async () => {
    await insertAnnotation('u1', 'b1', {
      id: 'a1',
      user_id: 'u1',
      highlight_id: 'hX',
      text: 't1',
      top: 1,
      point_x: null,
      color: '#000',
      updated_at: new Date(1).toISOString(),
      version: 1
    })

    await updateAnnotation('u1', 'b1', 'a1', {
      text: 't2',
      updated_at: new Date(2).toISOString()
    })

    const list = await listAnnotations('u1', 'b1')
    const a = list.find(x => x.id === 'a1')
    expect(a?.text).toBe('t2')

    await deleteAnnotation('u1', 'b1', 'a1')
    const list2 = await listAnnotations('u1', 'b1')
    expect(list2.some(x => x.id === 'a1')).toBe(false)
  })

  it('supports user notes upsert/list', async () => {
    await upsertUserNote('u1', {
      id: 'n1',
      user_id: 'u1',
      book_id: 'b1',
      quote: 'q',
      thought: 't',
      date: '2025-01-01',
      updated_at: new Date(1).toISOString(),
      version: 1
    })
    const list = await listUserNotes('u1')
    expect(list.some(n => n.id === 'n1')).toBe(true)
  })

  it('supports chapters upsert/list/delete', async () => {
    await upsertChapters('u1', 'b1', [
      {
        id: 'c1',
        user_id: 'u1',
        book_id: 'b1',
        title: '第一章',
        start_paragraph_index: 0,
        updated_at: new Date(1).toISOString(),
        version: 1
      },
      {
        id: 'c2',
        user_id: 'u1',
        book_id: 'b1',
        title: '第二章',
        start_paragraph_index: 10,
        updated_at: new Date(1).toISOString(),
        version: 1
      }
    ])
    const list = await listChapters('u1', 'b1')
    expect(list.map(x => x.id)).toEqual(['c1', 'c2'])

    await deleteChapter('u1', 'c1')
    const list2 = await listChapters('u1', 'b1')
    expect(list2.some(x => x.id === 'c1')).toBe(false)
  })
})
