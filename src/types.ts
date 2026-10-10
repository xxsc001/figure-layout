export type AcceptedMime = 'image/png' | 'image/jpeg' | 'image/webp'
export type ImageFit = 'contain' | 'cover'
export type LabelMode = 'uppercase' | 'lowercase' | 'none'
export type LabelFont = 'arial' | 'times' | 'georgia' | 'verdana'
export type LabelWeight = 400 | 600 | 700
export type LabelPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
export type LabelPositionV1 = Extract<LabelPosition, 'top-left' | 'top-right'>
export type LayoutKind = 'equal-grid' | 'justified'
export type LayoutProfile = 'classic' | 'compact' | 'balanced'

export interface ImageAsset {
  id: string
  name: string
  mime: AcceptedMime
  width: number
  height: number
  size: number
  blob: Blob
  previewUrl: string
}

export interface PanelState {
  assetId: string
  fit: ImageFit
  zoom: number
  offsetX: number
  offsetY: number
  hiddenLabel: boolean
}

export interface FigureStyle {
  gap: number
  padding: number
  background: '#ffffff' | 'transparent'
  labelMode: LabelMode
  labelParentheses: boolean
  labelPosition: LabelPosition
  labelFont: LabelFont
  labelWeight: LabelWeight
  labelOffsetX: number
  labelOffsetY: number
  labelSize: number
  labelColor: string
}

export interface FigureStyleV1 extends Omit<
  FigureStyle,
  | 'labelParentheses'
  | 'labelPosition'
  | 'labelFont'
  | 'labelWeight'
  | 'labelOffsetX'
  | 'labelOffsetY'
> {
  labelPosition: LabelPositionV1
}

export interface ExportSettings {
  width: number
}

interface FigureProjectCore {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  assets: ImageAsset[]
  panelOrder: string[]
  panels: Record<string, PanelState>
  layoutProfile: LayoutProfile
  exportSettings: ExportSettings
}

export interface FigureProjectV1 extends FigureProjectCore {
  schemaVersion: 1
  style: FigureStyleV1
}

export interface FigureProjectV2 extends FigureProjectCore {
  schemaVersion: 2
  style: FigureStyle
}

export interface LayoutCandidate {
  id: string
  profile: LayoutProfile
  name: string
  description: string
  kind: LayoutKind
  rows: number[]
  score: number
}

export interface PanelFrame {
  assetId: string
  x: number
  y: number
  width: number
  height: number
  rowIndex: number
  columnIndex: number
}

export interface SolvedLayout {
  width: number
  height: number
  frames: PanelFrame[]
}

export interface ImageRenderRect {
  x: number
  y: number
  width: number
  height: number
  maxOffsetX: number
  maxOffsetY: number
}

export type StoredImageAsset = Omit<ImageAsset, 'previewUrl'>

export interface StoredFigureProjectV1 extends Omit<FigureProjectV1, 'assets'> {
  assets: StoredImageAsset[]
}

export interface StoredFigureProjectV2 extends Omit<FigureProjectV2, 'assets'> {
  assets: StoredImageAsset[]
}

export interface ProjectManifestAsset {
  id: string
  name: string
  mime: AcceptedMime
  width: number
  height: number
  size: number
  path: string
  sha256: string
}

export interface FiggridManifestV1 extends Omit<FigureProjectV1, 'assets'> {
  assets: ProjectManifestAsset[]
}

export interface FiggridManifestV2 extends Omit<FigureProjectV2, 'assets'> {
  assets: ProjectManifestAsset[]
}

export interface ProjectSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  panelCount: number
  thumbnail: Blob | null
  thumbnailUpdatedAt: string | null
}

export interface BackupPreferences {
  enabled: boolean
  rootHandle: FileSystemDirectoryHandle | null
  projectFolders: Record<string, string>
  lastBackupAt: Record<string, string>
  lastHistoryAt: Record<string, string>
}

export type BackupPermissionState = PermissionState | 'unsupported'

export type BackupStatus =
  | 'unsupported'
  | 'disabled'
  | 'needs-permission'
  | 'idle'
  | 'scheduled'
  | 'writing'
  | 'error'
