// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createId, sha256Hex } from './browser-crypto'

describe('HTTP-compatible browser crypto', () => {
  it('creates an RFC 4122 version 4 identifier without randomUUID', () => {
    const id = createId({
      getRandomValues(bytes) {
        bytes.fill(0)
        return bytes
      },
    })

    expect(id).toBe('00000000-0000-4000-8000-000000000000')
  })

  it('calculates SHA-256 when SubtleCrypto is unavailable', async () => {
    const digest = await sha256Hex(new Blob(['abc']), {})

    expect(digest).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
