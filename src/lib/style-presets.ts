import { notifyWorkspaceChanged } from './workspace-events'
import { createId } from './browser-crypto'
import type { FigureProjectV2, FigureStyle, ExportSettings, LayoutProfile, PanelState } from '../types'

export const STYLE_PRESETS_KEY = 'layout-assistant:style-presets:v1'
export interface StylePreset {
  id: string
  name: string
  style: FigureStyle
  exportSettings: ExportSettings
  layoutProfile: LayoutProfile
  panels: Array<Omit<PanelState, 'assetId'>>
}

export function captureStylePreset(project: FigureProjectV2, name: string, id = createId()): StylePreset {
  const trimmed = name.trim().slice(0, 60)
  if (!trimmed) throw new Error('请输入样式名称。')
  return {
    id, name: trimmed, style: { ...project.style },
    exportSettings: { ...project.exportSettings }, layoutProfile: project.layoutProfile,
    panels: project.panelOrder.map((assetId) => {
      const panel = project.panels[assetId]
      return { fit: panel.fit, zoom: panel.zoom, offsetX: panel.offsetX, offsetY: panel.offsetY, hiddenLabel: panel.hiddenLabel }
    }),
  }
}

export function applyStylePreset(project: FigureProjectV2, preset: StylePreset): FigureProjectV2 {
  return {
    ...project, style: { ...preset.style }, exportSettings: { ...preset.exportSettings },
    layoutProfile: preset.layoutProfile,
    panels: Object.fromEntries(project.panelOrder.map((id, index) => [
      id, { ...project.panels[id], ...preset.panels[index], assetId: id },
    ])),
  }
}

export function readStylePresets(): StylePreset[] {
  const raw = localStorage.getItem(STYLE_PRESETS_KEY)
  if (!raw) return []
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value) || value.some((preset) => !preset || typeof preset.id !== 'string' || typeof preset.name !== 'string' || !preset.style || !preset.exportSettings || !['classic', 'compact', 'balanced'].includes(preset.layoutProfile) || !Array.isArray(preset.panels))) {
    throw new Error('常用样式读取失败。')
  }
  return value as StylePreset[]
}

export function writeStylePresets(presets: StylePreset[]) {
  localStorage.setItem(STYLE_PRESETS_KEY, JSON.stringify(presets))
  notifyWorkspaceChanged()
}
