import { describe, expect, it } from 'vitest'
import { reorderPanelOrder } from './reorder'

const order = ['a', 'b', 'c', 'd']

describe('panel reordering', () => {
  it('inserts before a target and keeps every panel exactly once', () => {
    expect(reorderPanelOrder(order, 'd', 'b', 'before'))
      .toEqual(['a', 'd', 'b', 'c'])
  })

  it('inserts after a target', () => {
    expect(reorderPanelOrder(order, 'a', 'c', 'after'))
      .toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves panels to the first and last positions', () => {
    expect(reorderPanelOrder(order, 'd', 'a', 'before'))
      .toEqual(['d', 'a', 'b', 'c'])
    expect(reorderPanelOrder(order, 'a', 'd', 'after'))
      .toEqual(['b', 'c', 'd', 'a'])
  })

  it('returns the original array for adjacent no-op insertions', () => {
    expect(reorderPanelOrder(order, 'b', 'a', 'after')).toBe(order)
    expect(reorderPanelOrder(order, 'b', 'c', 'before')).toBe(order)
  })

  it('returns the original array for invalid ids or the same panel', () => {
    expect(reorderPanelOrder(order, 'a', 'a', 'after')).toBe(order)
    expect(reorderPanelOrder(order, 'missing', 'a', 'before')).toBe(order)
    expect(reorderPanelOrder(order, 'a', 'missing', 'after')).toBe(order)
  })
})
