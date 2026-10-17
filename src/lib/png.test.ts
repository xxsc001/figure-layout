import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { setPngDpi } from './png'

const fixture = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'))
function chunks(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer)
  const result: Array<{ type: string; bytes: Uint8Array }> = []
  for (let i = 8; i < bytes.length;) {
    const end = i + view.getUint32(i) + 12
    result.push({ type: String.fromCharCode(...bytes.subarray(i + 4, i + 8)), bytes: bytes.slice(i, end) })
    i = end
  }
  return result
}
describe('PNG resolution metadata', () => {
  it('writes 300 dpi with the correct CRC and preserves all original chunks', () => {
    const output = setPngDpi(fixture.buffer)
    const entries = chunks(output)
    const physical = entries.find(chunk => chunk.type === 'pHYs')!
    const view = new DataView(physical.bytes.buffer)
    expect(view.getUint32(8)).toBe(11811)
    expect(view.getUint32(12)).toBe(11811)
    expect(view.getUint8(16)).toBe(1)
    expect(view.getUint32(17)).toBe(0x78a53f76)
    expect(entries.filter(chunk => chunk.type !== 'pHYs')).toEqual(chunks(fixture.buffer))
    expect(entries.findIndex(chunk => chunk.type === 'pHYs')).toBeLessThan(entries.findIndex(chunk => chunk.type === 'IDAT'))
  })
  it('replaces existing density metadata without duplicating it', () => {
    const output = setPngDpi(setPngDpi(fixture.buffer, 96))
    expect(output).toEqual(setPngDpi(fixture.buffer))
    expect(chunks(output).filter(chunk => chunk.type === 'pHYs')).toHaveLength(1)
  })
  it('rejects invalid or truncated PNG data', () => {
    expect(() => setPngDpi(new ArrayBuffer(8))).toThrow()
    expect(() => setPngDpi(fixture.buffer.slice(0, 25))).toThrow()
  })
})
