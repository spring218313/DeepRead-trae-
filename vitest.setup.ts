import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  try {
    localStorage.clear()
  } catch {}
})

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    beginPath: () => {},
    clearRect: () => {},
    lineTo: () => {},
    moveTo: () => {},
    stroke: () => {},
    lineCap: 'round',
    lineWidth: 1,
    strokeStyle: '#000'
  })
})
