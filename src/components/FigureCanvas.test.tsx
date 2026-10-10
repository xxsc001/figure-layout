import '../test/setup'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyProject, defaultPanelState } from '../lib/project'
import { FigureCanvas } from './FigureCanvas'

beforeAll(() => {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
      this.pointerType = init.pointerType ?? ''
    }
  }
  Object.defineProperty(window, 'PointerEvent', {
    configurable: true,
    value: TestPointerEvent,
  })
  Object.defineProperties(Element.prototype, {
    setPointerCapture: { configurable: true, value: vi.fn() },
    hasPointerCapture: { configurable: true, value: vi.fn(() => false) },
    releasePointerCapture: { configurable: true, value: vi.fn() },
  })
})

afterEach(() => cleanup())

function fixture() {
  const project = createEmptyProject()
  for (const id of ['a', 'b']) {
    const blob = new Blob([id], { type: 'image/png' })
    project.assets.push({
      id,
      name: `${id}.png`,
      mime: 'image/png',
      width: 100,
      height: 100,
      size: blob.size,
      blob,
      previewUrl: `blob:${id}`,
    })
    project.panelOrder.push(id)
    project.panels[id] = defaultPanelState(id)
  }
  return {
    project,
    solved: {
      width: 220,
      height: 100,
      frames: [
        { assetId: 'a', x: 0, y: 0, width: 100, height: 100, rowIndex: 0, columnIndex: 0 },
        { assetId: 'b', x: 120, y: 0, width: 100, height: 100, rowIndex: 0, columnIndex: 1 },
      ],
    },
  }
}

describe('interactive figure canvas', () => {
  it('keeps a short pointer movement as selection instead of reordering', () => {
    const onSelect = vi.fn()
    const onReorder = vi.fn()
    const { container } = render(
      <FigureCanvas
        {...fixture()}
        interactive
        onSelect={onSelect}
        onReorder={onReorder}
      />,
    )
    const hitbox = container.querySelector('.panel-hitbox')!

    fireEvent.pointerDown(hitbox, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 10,
      clientY: 10,
    })
    fireEvent.pointerMove(hitbox, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 13,
      clientY: 12,
    })
    fireEvent.pointerUp(hitbox, { pointerId: 1, pointerType: 'mouse' })

    expect(onSelect).toHaveBeenCalledWith('a')
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('does not reorder after pointer cancellation', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <FigureCanvas {...fixture()} interactive onReorder={onReorder} />,
    )
    const hitbox = container.querySelector('.panel-hitbox')!

    fireEvent.pointerDown(hitbox, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 10,
      clientY: 10,
    })
    fireEvent.pointerCancel(hitbox, { pointerId: 2, pointerType: 'touch' })

    expect(onReorder).not.toHaveBeenCalled()
  })

  it('cancels the pending gesture with Escape', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <FigureCanvas {...fixture()} interactive onReorder={onReorder} />,
    )
    const hitbox = container.querySelector('.panel-hitbox')!

    fireEvent.pointerDown(hitbox, {
      pointerId: 3,
      pointerType: 'pen',
      clientX: 10,
      clientY: 10,
    })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(hitbox, { pointerId: 3, pointerType: 'pen' })

    expect(onReorder).not.toHaveBeenCalled()
  })
})
