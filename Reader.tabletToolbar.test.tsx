import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Reader } from './components/Reader'
import { Book } from './types'

function setTabletLandscape() {
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true })
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
  window.dispatchEvent(new Event('resize'))
}

const book: Book = {
  id: 'b1',
  title: 'T',
  author: 'A',
  coverColor: 'bg-gradient-to-br from-blue-400 to-cyan-300 backdrop-blur-md',
  progress: 0,
  totalParams: 4,
  content: ['p1', 'p2', 'p3', 'p4']
}

describe('Reader tablet landscape notebook toolbar', () => {
  it('buttons remain clickable in pencil mode split view', async () => {
    setTabletLandscape()
    render(<Reader book={book} onClose={() => {}} onSaveNote={() => {}} />)

    const pencilBtn = await screen.findByLabelText('Pencil')
    fireEvent.click(pencilBtn)

    await screen.findByLabelText('退出')

    const modeToggle = await screen.findByLabelText(/(打字输入|手写输入)/)
    fireEvent.click(modeToggle)

    await waitFor(() => {
      expect(screen.getByLabelText(/(打字输入|手写输入)/)).toBeTruthy()
    })

    const eraserBtn = await screen.findByLabelText(/触碰区域擦除|整笔擦除/)
    fireEvent.click(eraserBtn)
    expect(eraserBtn.className).toMatch(/ring-2/)

    const exitBtn = await screen.findByLabelText('退出')
    fireEvent.click(exitBtn)
    await waitFor(() => {
      expect(screen.queryByLabelText('退出')).toBeNull()
    })
  })
})

