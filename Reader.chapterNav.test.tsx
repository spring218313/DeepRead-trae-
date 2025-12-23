import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Reader } from './components/Reader'
import { Book } from './types'

const book: Book = {
  id: 'b_nav',
  title: 'NavBook',
  author: 'A',
  coverColor: 'bg-gradient-to-br from-blue-400 to-cyan-300 backdrop-blur-md',
  progress: 0,
  totalParams: 6,
  content: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
}

describe('Reader chapter navigation', () => {
  it('opens chapter panel and navigates to selected page', async () => {
    localStorage.removeItem('dr_chapters_b_nav')
    localStorage.removeItem('dr_chapters_backup_b_nav')
    localStorage.removeItem('dr_chapters_backup_meta_b_nav')
    localStorage.setItem('dr_chapters_b_nav', JSON.stringify([
      { id: 'c1', bookId: 'b_nav', title: '第一章', startParagraphIndex: 0 },
      { id: 'c2', bookId: 'b_nav', title: '第二章', startParagraphIndex: 3 }
    ]))
    render(<Reader book={book} onClose={() => {}} onSaveNote={() => {}} />)

    const chaptersBtn = await screen.findByLabelText('Chapters')
    fireEvent.click(chaptersBtn)

    await screen.findByText('Chapters')

    const chapter2 = await screen.findByLabelText('Chapter 第二章')
    fireEvent.click(chapter2)

    await waitFor(() => {
      expect(screen.getByText('50%')).toBeTruthy()
    })
  })

  it('migrates simulated chapters to a valid chapter list', async () => {
    localStorage.removeItem('dr_chapters_b_nav')
    localStorage.removeItem('dr_chapters_backup_b_nav')
    localStorage.removeItem('dr_chapters_backup_meta_b_nav')
    localStorage.setItem('dr_chapters_b_nav', JSON.stringify([
      { id: 'p1', bookId: 'b_nav', title: 'Page 1', startParagraphIndex: 0 }
    ]))
    render(<Reader book={book} onClose={() => {}} onSaveNote={() => {}} />)

    const chaptersBtn = await screen.findByLabelText('Chapters')
    fireEvent.click(chaptersBtn)

    await screen.findByText('Chapters')
    await screen.findByLabelText('Chapter NavBook')
    expect(screen.queryByText('Page 1')).toBeNull()
  })
})
