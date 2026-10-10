import '../test/setup'
import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE } from '../constants'
import type { ImageAsset, PanelFrame } from '../types'
import {
  enumerateRowPartitions,
  generateLayoutCandidates,
  solveLayout,
} from './layout'

function createAssets(count: number): ImageAsset[] {
  const ratios = [1, 1.5, 0.75, 2, 0.6, 1.2]
  return Array.from({ length: count }, (_, index) => {
    const ratio = ratios[index % ratios.length]
    return {
      id: `asset-${index}`,
      name: `panel-${index}.png`,
      mime: 'image/png',
      width: Math.round(1000 * ratio),
      height: 1000,
      size: 16,
      blob: new Blob(['fixture'], { type: 'image/png' }),
      previewUrl: `blob:asset-${index}`,
    }
  })
}

function overlaps(a: PanelFrame, b: PanelFrame) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  )
}

describe('layout engine', () => {
  it('enumerates ordered row partitions with a four-panel maximum', () => {
    const partitions = enumerateRowPartitions(6)
    expect(partitions).toContainEqual([2, 2, 2])
    expect(partitions).toContainEqual([3, 3])
    expect(partitions.every((rows) => rows.every((count) => count <= 4))).toBe(true)
  })

  it.each([2, 6, 7, 9, 12])(
    'creates three unique, valid candidates for %i images',
    (count) => {
      const assets = createAssets(count)
      const candidates = generateLayoutCandidates(assets)
      expect(candidates).toHaveLength(3)
      expect(
        new Set(
          candidates.map(
            (candidate) => `${candidate.kind}:${candidate.rows.join('-')}`,
          ),
        ).size,
      ).toBe(3)

      candidates.forEach((candidate) => {
        expect(candidate.rows.reduce((sum, value) => sum + value, 0)).toBe(count)
        expect(Math.max(...candidate.rows)).toBeLessThanOrEqual(4)
        const solved = solveLayout(candidate, assets, DEFAULT_STYLE)
        expect(solved.frames.map((frame) => frame.assetId)).toEqual(
          assets.map((asset) => asset.id),
        )
        solved.frames.forEach((frame) => {
          expect(frame.x).toBeGreaterThanOrEqual(0)
          expect(frame.y).toBeGreaterThanOrEqual(0)
          expect(frame.x + frame.width).toBeLessThanOrEqual(solved.width + 0.001)
          expect(frame.y + frame.height).toBeLessThanOrEqual(solved.height + 0.001)
        })
        for (let left = 0; left < solved.frames.length; left += 1) {
          for (let right = left + 1; right < solved.frames.length; right += 1) {
            expect(overlaps(solved.frames[left], solved.frames[right])).toBe(false)
          }
        }
      })
    },
  )

  it('is deterministic for identical input', () => {
    const assets = createAssets(9)
    expect(generateLayoutCandidates(assets)).toEqual(
      generateLayoutCandidates(assets),
    )
  })
})