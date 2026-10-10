import type {
  FigureProjectV2,
  ImageAsset,
  PanelFrame,
  SolvedLayout,
} from '../types'
import { getImageRenderRect, getPanelLabel } from './geometry'
import { getLabelPlacement } from './labels'

import { encodeTiff } from './tiff'

const MAX_EXPORT_PIXELS = 80_000_000
const MAX_EXPORT_DIMENSION = 16_384

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取图片失败。'))
    reader.readAsDataURL(blob)
  })
}

async function getEmbeddedAssets(assets: ImageAsset[]) {
  const entries = await Promise.all(
    assets.map(async (asset) => [asset.id, await blobToDataUrl(asset.blob)] as const),
  )
  return new Map(entries)
}

function imageMarkup(
  project: FigureProjectV2,
  asset: ImageAsset,
  frame: PanelFrame,
  href: string,
) {
  const panel = project.panels[asset.id]
  const rect = getImageRenderRect(frame, asset, panel)
  const clipId = `clip-${asset.id.replace(/[^a-zA-Z0-9_-]/g, '')}`
  return [
    `<clipPath id="${clipId}"><rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" /></clipPath>`,
    `<image href="${href}" x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" clip-path="url(#${clipId})" />`,
  ].join('')
}

export async function buildSvgString(
  project: FigureProjectV2,
  solved: SolvedLayout,
) {
  const embedded = await getEmbeddedAssets(project.assets)
  const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]))
  const frameMarkup = solved.frames
    .map((frame) => {
      const asset = assetMap.get(frame.assetId)
      if (!asset) return ''
      return imageMarkup(project, asset, frame, embedded.get(asset.id) ?? '')
    })
    .join('')

  const labelMarkup = solved.frames
    .map((frame) => {
      const panel = project.panels[frame.assetId]
      const index = project.panelOrder.indexOf(frame.assetId)
      const label = getPanelLabel(
        index,
        project.style.labelMode,
        project.style.labelParentheses,
      )
      if (!label || panel.hiddenLabel) return ''
      const placement = getLabelPlacement(frame, project.style)
      return `<text x="${placement.x}" y="${placement.y}" text-anchor="${placement.textAnchor}" font-family="${escapeXml(placement.fontFamily)}" font-size="${project.style.labelSize}" font-weight="${placement.fontWeight}" fill="${escapeXml(project.style.labelColor)}" stroke="#ffffff" stroke-width="${project.style.labelSize * 0.1}" paint-order="stroke fill">${label}</text>`
    })
    .join('')

  const background =
    project.style.background === 'transparent'
      ? ''
      : `<rect width="100%" height="100%" fill="#ffffff" />`

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${solved.width}" height="${solved.height}" viewBox="0 0 ${solved.width} ${solved.height}">`,
    background,
    '<defs>',
    solved.frames
      .map((frame) => {
        const asset = assetMap.get(frame.assetId)
        if (!asset) return ''
        const markup = imageMarkup(
          project,
          asset,
          frame,
          embedded.get(asset.id) ?? '',
        )
        const clipEnd = markup.indexOf('</clipPath>') + '</clipPath>'.length
        return markup.slice(0, clipEnd)
      })
      .join(''),
    '</defs>',
    frameMarkup.replace(/<clipPath[\s\S]*?<\/clipPath>/g, ''),
    labelMarkup,
    '</svg>',
  ].join('')
}

export async function createSvgBlob(
  project: FigureProjectV2,
  solved: SolvedLayout,
) {
  return new Blob([await buildSvgString(project, solved)], {
    type: 'image/svg+xml;charset=utf-8',
  })
}

function loadSvgImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('SVG 渲染失败。'))
    }
    image.src = url
  })
}

export async function createPngBlob(
  project: FigureProjectV2,
  solved: SolvedLayout,
  outputWidth: number,
) {
  return createRasterBlob(project, solved, outputWidth, 'image/png')
}

async function renderRasterCanvas(
  project: FigureProjectV2,
  solved: SolvedLayout,
  outputWidth: number,
) {
  const outputHeight = Math.round((solved.height / solved.width) * outputWidth)
  if (
    outputWidth > MAX_EXPORT_DIMENSION ||
    outputHeight > MAX_EXPORT_DIMENSION ||
    outputWidth * outputHeight > MAX_EXPORT_PIXELS
  ) {
    throw new Error('当前布局在该宽度下过大，请降低导出宽度。')
  }
  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器无法创建导出画布。')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  const image = await loadSvgImage(await createSvgBlob(project, solved))
  context.drawImage(image, 0, 0, outputWidth, outputHeight)
  return canvas
}

export async function createTiffBlob(project: FigureProjectV2, solved: SolvedLayout, outputWidth: number) {
  const canvas = await renderRasterCanvas(project, solved, outputWidth)
  const context = canvas.getContext('2d')!
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  return new Blob([encodeTiff(canvas.width, canvas.height, pixels.data)], { type: 'image/tiff' })
}

export async function createRasterBlob(
  project: FigureProjectV2,
  solved: SolvedLayout,
  outputWidth: number,
  mime: 'image/png' | 'image/webp',
  quality?: number,
) {
  const canvas = await renderRasterCanvas(project, solved, outputWidth)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG 编码失败。'))),
      mime,
      quality,
    )
  })
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
