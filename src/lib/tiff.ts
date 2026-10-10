/** TIFF 6.0: little-endian, uncompressed 8-bit RGBA with straight alpha. */
export function encodeTiff(width: number, height: number, rgba: Uint8ClampedArray, dpi = 300): ArrayBuffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 80_000_000 || rgba.length !== width * height * 4 || !Number.isInteger(dpi) || dpi < 1) {
    throw new Error('TIFF 图像尺寸或像素数据无效。')
  }
  const count = 15
  const bitsOffset = 8 + 2 + count * 12 + 4
  const xResolution = bitsOffset + 8
  const yResolution = xResolution + 8
  const pixelOffset = yResolution + 8
  const buffer = new ArrayBuffer(pixelOffset + rgba.length)
  const view = new DataView(buffer)
  view.setUint16(0, 0x4949, true)
  view.setUint16(2, 42, true)
  view.setUint32(4, 8, true)
  view.setUint16(8, count, true)
  const entries = [
    [256, 4, 1, width], [257, 4, 1, height], [258, 3, 4, bitsOffset],
    [259, 3, 1, 1], [262, 3, 1, 2], [273, 4, 1, pixelOffset],
    [274, 3, 1, 1], [277, 3, 1, 4], [278, 4, 1, height],
    [279, 4, 1, rgba.length], [282, 5, 1, xResolution], [283, 5, 1, yResolution],
    [284, 3, 1, 1], [296, 3, 1, 2], [338, 3, 1, 2],
  ]
  entries.forEach(([tag, type, length, value], index) => {
    const offset = 10 + index * 12
    view.setUint16(offset, tag, true)
    view.setUint16(offset + 2, type, true)
    view.setUint32(offset + 4, length, true)
    if (type === 3 && length === 1) view.setUint16(offset + 8, value, true)
    else view.setUint32(offset + 8, value, true)
  })
  for (let index = 0; index < 4; index++) view.setUint16(bitsOffset + index * 2, 8, true)
  for (const offset of [xResolution, yResolution]) {
    view.setUint32(offset, dpi, true)
    view.setUint32(offset + 4, 1, true)
  }
  new Uint8Array(buffer, pixelOffset).set(rgba)
  return buffer
}
