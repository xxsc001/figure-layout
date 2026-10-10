import {
  ACCEPTED_MIME_TYPES,
  MAX_FILE_BYTES,
  MAX_IMAGE_PIXELS,
  MAX_PANEL_COUNT,
  MAX_TOTAL_BYTES,
} from '../constants'
import type { AcceptedMime, ImageAsset } from '../types'
import { createId } from './browser-crypto'

export interface ImageImportResult {
  assets: ImageAsset[]
  errors: string[]
}

function inferMime(file: File): AcceptedMime | null {
  if (ACCEPTED_MIME_TYPES.includes(file.type as AcceptedMime)) {
    return file.type as AcceptedMime
  }
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  return null
}

async function decodeDimensions(file: File) {
  const bitmap = await createImageBitmap(file)
  const result = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return result
}

export async function importImageFiles(
  files: File[],
  existingAssets: ImageAsset[],
): Promise<ImageImportResult> {
  const errors: string[] = []
  const assets: ImageAsset[] = []
  const availableSlots = MAX_PANEL_COUNT - existingAssets.length
  const selected = files.slice(0, Math.max(0, availableSlots))

  if (files.length > availableSlots) {
    errors.push(`最多支持 ${MAX_PANEL_COUNT} 张图片，超出的文件未导入。`)
  }

  let totalBytes = existingAssets.reduce((sum, asset) => sum + asset.size, 0)
  for (const file of selected) {
    const mime = inferMime(file)
    if (!mime) {
      errors.push(`${file.name}：不支持该格式，请使用 PNG、JPG 或 WebP。`)
      continue
    }
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`${file.name}：文件超过 25MB。`)
      continue
    }
    if (totalBytes + file.size > MAX_TOTAL_BYTES) {
      errors.push(`${file.name}：导入后工程总大小会超过 150MB。`)
      continue
    }
    try {
      const { width, height } = await decodeDimensions(file)
      if (width <= 0 || height <= 0) throw new Error('invalid dimensions')
      if (width * height > MAX_IMAGE_PIXELS) {
        errors.push(`${file.name}：图片超过 4000 万像素。`)
        continue
      }
      const id = createId()
      assets.push({
        id,
        name: file.name,
        mime,
        width,
        height,
        size: file.size,
        blob: file,
        previewUrl: URL.createObjectURL(file),
      })
      totalBytes += file.size
    } catch {
      errors.push(`${file.name}：图片损坏或浏览器无法解码。`)
    }
  }

  return { assets, errors }
}

export async function replaceImageFile(
  file: File,
  previous: ImageAsset,
  allAssets: ImageAsset[],
): Promise<ImageAsset> {
  const result = await importImageFiles(
    [file],
    allAssets.filter((asset) => asset.id !== previous.id),
  )
  if (result.errors.length > 0 || result.assets.length !== 1) {
    throw new Error(result.errors[0] || '无法替换图片。')
  }
  const [replacement] = result.assets
  return { ...replacement, id: previous.id }
}
