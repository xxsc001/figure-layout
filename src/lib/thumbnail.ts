import type { FigureProjectV2 } from '../types'
import { createRasterBlob } from './export'
import { generateLayoutCandidates, solveLayout } from './layout'

const THUMBNAIL_WIDTH = 560
const SINGLE_PREVIEW_HEIGHT = 420

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: 'image/webp' | 'image/png',
  quality?: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob
        ? resolve(blob)
        : reject(new Error('工程预览编码失败。')),
      mime,
      quality,
    )
  })
}

async function createSingleImageThumbnail(project: FigureProjectV2) {
  const asset = project.assets[0]
  const bitmap = await createImageBitmap(asset.blob)
  const canvas = document.createElement('canvas')
  canvas.width = THUMBNAIL_WIDTH
  canvas.height = SINGLE_PREVIEW_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('浏览器无法创建工程预览。')
  }
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  const scale = Math.min(
    canvas.width / bitmap.width,
    canvas.height / bitmap.height,
  )
  const width = bitmap.width * scale
  const height = bitmap.height * scale
  context.drawImage(
    bitmap,
    (canvas.width - width) / 2,
    (canvas.height - height) / 2,
    width,
    height,
  )
  bitmap.close()
  try {
    return await canvasToBlob(canvas, 'image/webp', 0.82)
  } catch {
    return canvasToBlob(canvas, 'image/png')
  }
}

export async function createProjectThumbnail(
  project: FigureProjectV2,
): Promise<Blob | null> {
  const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]))
  const orderedAssets = project.panelOrder
    .map((id) => assetMap.get(id))
    .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
  if (orderedAssets.length === 0) return null
  if (orderedAssets.length === 1) return createSingleImageThumbnail(project)

  const candidates = generateLayoutCandidates(orderedAssets)
  const selected = candidates.find(
    (candidate) => candidate.profile === project.layoutProfile,
  ) ?? candidates[0]
  if (!selected) return null
  const solved = solveLayout(selected, orderedAssets, project.style)
  try {
    return await createRasterBlob(
      project,
      solved,
      THUMBNAIL_WIDTH,
      'image/webp',
      0.82,
    )
  } catch {
    return createRasterBlob(project, solved, THUMBNAIL_WIDTH, 'image/png')
  }
}
