import '../test/setup'
import { describe, expect, it } from 'vitest'
import { createEmptyProject, defaultPanelState, migrateFigureStyle } from './project'
import { buildSvgString } from './export'
import { getLabelPlacement } from './labels'
import type { LabelPosition, PanelFrame } from '../types'

const frame: PanelFrame = {
  assetId: 'asset',
  x: 10,
  y: 20,
  width: 300,
  height: 200,
  rowIndex: 0,
  columnIndex: 0,
}

describe('panel label styling', () => {
  it.each(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const)('moves the label itself for negative margins at %s', (labelPosition) => {
    const style = { ...createEmptyProject().style, labelPosition, labelOffsetX: 0, labelOffsetY: 0 }
    const original = getLabelPlacement(frame, style)
    const moved = getLabelPlacement(frame, { ...style, labelOffsetX: -20, labelOffsetY: -15 })
    expect(moved.x - original.x).toBeCloseTo(labelPosition.endsWith('left') ? -20 : 20)
    expect(moved.y - original.y).toBeCloseTo(labelPosition.startsWith('top') ? -15 : 15)
  })

  it('preserves outside label spacing when reopening projects', () => {
    const style = { ...createEmptyProject().style, labelOffsetX: -40, labelOffsetY: -20 }
    expect(migrateFigureStyle(style)).toMatchObject({ labelOffsetX: -40, labelOffsetY: -20 })
  })

  it.each([
    ['top-left', 'start', 30, 54.4],
    ['top-right', 'end', 290, 54.4],
    ['bottom-left', 'start', 30, 197.6],
    ['bottom-right', 'end', 290, 197.6],
  ] as const)('places labels at %s', (position, anchor, x, y) => {
    const placement = getLabelPlacement(frame, {
      labelPosition: position as LabelPosition,
      labelFont: 'georgia',
      labelWeight: 600,
      labelOffsetX: 20,
      labelOffsetY: 20,
      labelSize: 20,
    })

    expect(placement.textAnchor).toBe(anchor)
    expect(placement.x).toBeCloseTo(x)
    expect(placement.y).toBeCloseTo(y)
    expect(placement.fontFamily).toContain('Georgia')
    expect(placement.fontWeight).toBe(600)
  })

  it('clamps large offsets so labels remain inside a small panel', () => {
    const placement = getLabelPlacement(
      { ...frame, width: 40, height: 40 },
      {
        labelPosition: 'bottom-right',
        labelFont: 'arial',
        labelWeight: 700,
        labelOffsetX: 120,
        labelOffsetY: 120,
        labelSize: 30,
      },
    )

    expect(placement.x).toBeGreaterThanOrEqual(frame.x)
    expect(placement.x).toBeLessThanOrEqual(frame.x + 40)
    expect(placement.y).toBeGreaterThanOrEqual(frame.y)
    expect(placement.y).toBeLessThanOrEqual(frame.y + 40)
  })

  it('uses the same font and placement in exported SVG text', async () => {
    const project = createEmptyProject()
    const blob = new Blob(['image'], { type: 'image/png' })
    project.assets = [{
      id: 'asset',
      name: 'panel.png',
      mime: 'image/png',
      width: 100,
      height: 100,
      size: blob.size,
      blob,
      previewUrl: 'blob:asset',
    }]
    project.panelOrder = ['asset']
    project.panels = { asset: defaultPanelState('asset') }
    project.style = {
      ...project.style,
      labelFont: 'times',
      labelWeight: 400,
      labelMode: 'lowercase',
      labelParentheses: true,
      labelPosition: 'bottom-right',
      labelOffsetX: 24,
      labelOffsetY: 18,
    }

    const svg = await buildSvgString(project, {
      width: 320,
      height: 240,
      frames: [frame],
    })

    expect(svg).toContain('font-family="&quot;Times New Roman&quot;, Times, serif"')
    expect(svg).toContain('font-weight="400"')
    expect(svg).toContain('text-anchor="end"')
    expect(svg).toContain('>(a)</text>')
  })
})
