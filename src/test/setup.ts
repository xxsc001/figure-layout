import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { vi } from 'vitest'

let objectUrlCounter = 0

if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => `blob:test-${objectUrlCounter++}`)
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn()
}

if (!globalThis.createImageBitmap) {
  globalThis.createImageBitmap = vi.fn(async () => ({
    width: 1200,
    height: 800,
    close: vi.fn(),
  })) as unknown as typeof createImageBitmap
}

window.confirm = vi.fn(() => true)