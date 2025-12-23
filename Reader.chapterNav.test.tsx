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
    render(<Reader book={book} onClose={() => {}} onSaveNote={() => {}} />)

    const chaptersBtn = await screen.findByLabelText('Chapters')
    fireEvent.click(chaptersBtn)

    await screen.findByText('Chapters')

    const page2 = await screen.findByLabelText('Chapter Page 2')
    fireEvent.click(page2)

    await waitFor(() => {
      expect(screen.getByText('50%')).toBeTruthy()
    })
  })
})

