/** Update PNG physical resolution without decoding or changing image data. */
export function setPngDpi(buffer: ArrayBuffer, dpi = 300): ArrayBuffer {
  const bytes = new Uint8Array(buffer)
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (signature.some((value, index) => bytes[index] !== value)) throw new Error('无效的 PNG 文件。')
  if (!Number.isFinite(dpi) || dpi <= 0) throw new Error('无效的 DPI。')
  const chunk = new Uint8Array(21)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, 9)
  chunk.set([112, 72, 89, 115], 4) // pHYs
  const pixelsPerMeter = Math.round(dpi / 0.0254)
  view.setUint32(8, pixelsPerMeter)
  view.setUint32(12, pixelsPerMeter)
  chunk[16] = 1 // meters
  let crc = 0xffffffff
  for (const byte of chunk.subarray(4, 17)) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0)
  const parts: Uint8Array[] = [bytes.subarray(0, 8)]
  const source = new DataView(buffer)
  let inserted = false
  for (let offset = 8; offset < bytes.length;) {
    if (offset + 12 > bytes.length) throw new Error('PNG 数据不完整。')
    const length = source.getUint32(offset)
    const end = offset + length + 12
    if (end > bytes.length) throw new Error('PNG 数据不完整。')
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (!inserted && type === 'IDAT') {
      parts.push(chunk)
      inserted = true
    }
    if (type !== 'pHYs') parts.push(bytes.subarray(offset, end))
    offset = end
  }
  if (!inserted) throw new Error('PNG 缺少图像数据。')
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let cursor = 0
  for (const part of parts) { result.set(part, cursor); cursor += part.length }
  return result.buffer
}
