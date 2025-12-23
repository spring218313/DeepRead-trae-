import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

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
