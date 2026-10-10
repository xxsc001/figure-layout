import '../test/setup'
import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyProject, defaultPanelState } from './project'
import { applyStylePreset, captureStylePreset, readStylePresets, writeStylePresets } from './style-presets'

beforeEach(() => localStorage.clear())
describe('saved styles', () => {
  it('persists an independent snapshot including negative label offsets', () => {
    const project = createEmptyProject()
    project.style.labelOffsetX = -25
    project.exportSettings.width = 4000
    const preset = captureStylePreset(project, '  论文  ')
    project.style.labelOffsetX = 10
    writeStylePresets([preset])
    expect(readStylePresets()[0]).toMatchObject({ name: '论文', style: { labelOffsetX: -25 }, exportSettings: { width: 4000 } })
  })
  it('applies format to a different project without replacing its images or identity', () => {
    const source = createEmptyProject()
    source.panelOrder = ['source']
    source.panels.source = { ...defaultPanelState('source'), zoom: 0.75 }
    source.style.gap = 40
    const target = createEmptyProject()
    target.panelOrder = ['target', 'extra']
    target.panels = { target: defaultPanelState('target'), extra: defaultPanelState('extra') }
    const result = applyStylePreset(target, captureStylePreset(source, '论文'))
    expect(result.id).toBe(target.id)
    expect(result.assets).toBe(target.assets)
    expect(result.panelOrder).toBe(target.panelOrder)
    expect(result.style.gap).toBe(40)
    expect(result.panels.target).toMatchObject({ assetId: 'target', zoom: 0.75 })
    expect(result.panels.extra).toEqual(target.panels.extra)
    expect(target.panels.target.zoom).toBe(1)
  })
  it('rejects empty names and corrupted saved data', () => {
    expect(() => captureStylePreset(createEmptyProject(), ' ')).toThrow()
    localStorage.setItem('layout-assistant:style-presets:v1', '{}')
    expect(() => readStylePresets()).toThrow()
  })
})
