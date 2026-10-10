import { DEFAULT_STYLE, SCHEMA_VERSION } from '../constants'
import type {
  FigureProjectV2,
  FigureStyle,
  FigureStyleV1,
  ImageAsset,
  PanelState,
  StoredFigureProjectV1,
  StoredFigureProjectV2,
} from '../types'
import { createId } from './browser-crypto'

export function createEmptyProject(): FigureProjectV2 {
  const now = new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId(),
    title: '未命名 Figure',
    createdAt: now,
    updatedAt: now,
    assets: [],
    panelOrder: [],
    panels: {},
    layoutProfile: 'classic',
    style: { ...DEFAULT_STYLE },
    exportSettings: { width: 3000 },
  }
}

export function defaultPanelState(assetId: string): PanelState {
  return {
    assetId,
    fit: 'contain',
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    hiddenLabel: false,
  }
}

export function touchProject(project: FigureProjectV2): FigureProjectV2 {
  return { ...project, updatedAt: new Date().toISOString() }
}

export function toStoredProject(
  project: FigureProjectV2,
): StoredFigureProjectV2 {
  return {
    ...project,
    assets: project.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      mime: asset.mime,
      width: asset.width,
      height: asset.height,
      size: asset.size,
      blob: asset.blob,
    })),
  }
}

export function migrateFigureStyle(
  style: FigureStyleV1 | FigureStyle,
): FigureStyle {
  if ('labelFont' in style) {
    return {
      ...DEFAULT_STYLE,
      ...style,
      labelOffsetX: Math.min(120, Math.max(-120, style.labelOffsetX)),
      labelOffsetY: Math.min(120, Math.max(-120, style.labelOffsetY)),
    }
  }
  const legacyInset = Math.max(10, style.labelSize * 0.35)
  return {
    ...DEFAULT_STYLE,
    ...style,
    labelFont: 'arial',
    labelWeight: 700,
    labelOffsetX: legacyInset,
    labelOffsetY: legacyInset,
  }
}

export function migrateStoredProject(
  project: StoredFigureProjectV1 | StoredFigureProjectV2,
): StoredFigureProjectV2 {
  if (project.schemaVersion !== 1 && project.schemaVersion !== 2) {
    throw new Error('工程版本不受支持。')
  }
  return {
    ...project,
    schemaVersion: SCHEMA_VERSION,
    style: migrateFigureStyle(project.style),
  }
}

export function fromStoredProject(
  project: StoredFigureProjectV2,
): FigureProjectV2 {
  const assets: ImageAsset[] = project.assets.map((asset) => ({
    ...asset,
    previewUrl: URL.createObjectURL(asset.blob),
  }))
  return { ...project, assets }
}

export function projectFileName(project: FigureProjectV2, extension: string) {
  const safeTitle = Array.from(project.title.trim())
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
  return `${safeTitle || 'layout-assistant'}.${extension}`
}

export function normalizeProjectTitle(title: string) {
  return title.trim().slice(0, 80) || '未命名 Figure'
}

export function copyProjectAsNew(
  project: FigureProjectV2,
  title = project.title,
): FigureProjectV2 {
  const now = new Date().toISOString()
  return {
    ...project,
    id: createId(),
    title: normalizeProjectTitle(title),
    createdAt: now,
    updatedAt: now,
    assets: project.assets.map((asset) => ({ ...asset })),
    panels: Object.fromEntries(
      Object.entries(project.panels).map(([id, panel]) => [id, { ...panel }]),
    ),
    style: { ...project.style },
    exportSettings: { ...project.exportSettings },
  }
}
