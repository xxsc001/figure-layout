import { describe, expect, it } from 'vitest'
import { encodeTiff } from './tiff'

describe('TIFF encoding', () => {
  it('writes a valid IFD, resolution and exact transparent pixel data', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128])
    const buffer = encodeTiff(2, 1, pixels)
    const view = new DataView(buffer)
    expect(view.getUint16(0, true)).toBe(0x4949)
    expect(view.getUint16(2, true)).toBe(42)
    const ifd = view.getUint32(4, true)
    const tags = new Map<number, number>()
    for (let i = 0; i < view.getUint16(ifd, true); i++) {
      const offset = ifd + 2 + i * 12
      tags.set(view.getUint16(offset, true), view.getUint32(offset + 8, true))
    }
    expect(tags.get(256)).toBe(2)
    expect(tags.get(257)).toBe(1)
    expect(tags.get(259)).toBe(1)
    expect(tags.get(277)).toBe(4)
    expect(tags.get(338)).toBe(2)
    expect(tags.get(279)).toBe(8)
    expect(view.getUint32(tags.get(282)!, true)).toBe(300)
    expect(view.getUint32(tags.get(282)! + 4, true)).toBe(1)
    expect(view.getUint32(ifd + 2 + 15 * 12, true)).toBe(0)
    expect(new Uint8Array(buffer, tags.get(273))).toEqual(new Uint8Array(pixels))
  })
  it('rejects mismatched pixels and invalid dimensions', () => {
    expect(() => encodeTiff(2, 1, new Uint8ClampedArray(4))).toThrow()
    expect(() => encodeTiff(0, 1, new Uint8ClampedArray())).toThrow()
  })
})
