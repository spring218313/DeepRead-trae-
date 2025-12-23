import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'

describe('App import flow', () => {
  it('imports TXT from modal and shows book in shelf', async () => {
    const { container } = render(<App />)

    const importBtn = await screen.findByLabelText('Import book')
    fireEvent.click(importBtn)

    await screen.findByText('Import Book')

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null
    expect(fileInput).not.toBeNull()

    const file = new File(['Hello'], 'MyNewBook.txt', { type: 'text/plain' })
    fireEvent.change(fileInput!, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getAllByText('MyNewBook').length).toBeGreaterThan(0)
    })
  })
})

