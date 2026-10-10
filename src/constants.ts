import type { AcceptedMime, FigureStyle } from './types'

export const APP_NAME = '论文图片排版助手'
export const SCHEMA_VERSION = 2 as const
export const CANVAS_WIDTH = 1200
export const MIN_PANEL_COUNT = 2
export const MAX_PANEL_COUNT = 12
export const MAX_FILE_BYTES = 25 * 1024 * 1024
export const MAX_TOTAL_BYTES = 150 * 1024 * 1024
export const MAX_IMAGE_PIXELS = 40_000_000
export const ACCEPTED_MIME_TYPES: AcceptedMime[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
]

export const DEFAULT_STYLE: FigureStyle = {
  gap: 20,
  padding: 24,
  background: '#ffffff',
  labelMode: 'uppercase',
  labelParentheses: false,
  labelPosition: 'top-left',
  labelFont: 'arial',
  labelWeight: 700,
  labelOffsetX: 13,
  labelOffsetY: 13,
  labelSize: 36,
  labelColor: '#111827',
}

export const EXPORT_WIDTH_PRESETS = [2000, 3000, 4000]
