import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type {
  FigureProjectV2,
  ImageAsset,
  SolvedLayout,
} from '../types'
import { getImageRenderRect, getPanelLabel } from '../lib/geometry'
import { getLabelPlacement } from '../lib/labels'
import type { ReorderPosition } from '../lib/reorder'

interface FigureCanvasProps {
  project: FigureProjectV2
  solved: SolvedLayout
  selectedAssetId?: string | null
  interactive?: boolean
  onSelect?: (assetId: string) => void
  onReorder?: (
    draggedId: string,
    targetId: string,
    position: ReorderPosition,
  ) => void
  className?: string
}

interface PointerDragState {
  sourceId: string
  pointerId: number
  startX: number
  startY: number
  dragging: boolean
  targetId: string | null
  position: ReorderPosition
  captureElement: SVGRectElement
}

interface DragVisualState {
  sourceId: string
  targetId: string | null
  position: ReorderPosition
}

const DRAG_THRESHOLD = 5

export function FigureCanvas({
  project,
  solved,
  selectedAssetId,
  interactive = false,
  onSelect,
  onReorder,
  className = '',
}: FigureCanvasProps) {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const pointerDragRef = useRef<PointerDragState | null>(null)
  const [dragVisual, setDragVisual] = useState<DragVisualState | null>(null)
  const assetMap = new Map<string, ImageAsset>(
    project.assets.map((asset) => [asset.id, asset]),
  )

  const clearPointerDrag = useCallback(() => {
    const current = pointerDragRef.current
    if (
      current &&
      typeof current.captureElement.hasPointerCapture === 'function' &&
      current.captureElement.hasPointerCapture(current.pointerId)
    ) {
      current.captureElement.releasePointerCapture(current.pointerId)
    }
    pointerDragRef.current = null
    setDragVisual(null)
  }, [])

  useEffect(() => {
    const cancelWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !pointerDragRef.current) return
      event.preventDefault()
      clearPointerDrag()
    }
    window.addEventListener('keydown', cancelWithEscape)
    return () => window.removeEventListener('keydown', cancelWithEscape)
  }, [clearPointerDrag])

  const handlePointerDown = (
    event: ReactPointerEvent<SVGRectElement>,
    sourceId: string,
  ) => {
    if (!interactive || (event.pointerType === 'mouse' && event.button !== 0)) {
      return
    }
    onSelect?.(sourceId)
    if (!onReorder) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerDragRef.current = {
      sourceId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      targetId: null,
      position: 'before',
      captureElement: event.currentTarget,
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const current = pointerDragRef.current
    if (!current || current.pointerId !== event.pointerId || !onReorder) return

    const distance = Math.hypot(
      event.clientX - current.startX,
      event.clientY - current.startY,
    )
    if (!current.dragging && distance < DRAG_THRESHOLD) return

    const svg = svgRef.current
    if (!svg || typeof svg.getScreenCTM !== 'function') return
    const matrix = svg.getScreenCTM()
    if (!matrix) return
    event.preventDefault()

    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const local = point.matrixTransform(matrix.inverse())
    const target = solved.frames.find((frame) =>
      frame.assetId !== current.sourceId &&
      local.x >= frame.x &&
      local.x <= frame.x + frame.width &&
      local.y >= frame.y &&
      local.y <= frame.y + frame.height,
    )
    const position: ReorderPosition = target &&
      local.x >= target.x + target.width / 2
      ? 'after'
      : 'before'
    const next = {
      ...current,
      dragging: true,
      targetId: target?.assetId ?? null,
      position,
    }
    pointerDragRef.current = next
    setDragVisual((previous) => {
      if (
        previous?.sourceId === next.sourceId &&
        previous.targetId === next.targetId &&
        previous.position === next.position
      ) {
        return previous
      }
      return {
        sourceId: next.sourceId,
        targetId: next.targetId,
        position: next.position,
      }
    })
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGRectElement>) => {
    const current = pointerDragRef.current
    if (!current || current.pointerId !== event.pointerId) return
    const reorder = current.dragging && current.targetId
      ? {
          sourceId: current.sourceId,
          targetId: current.targetId,
          position: current.position,
        }
      : null
    clearPointerDrag()
    if (reorder) {
      onReorder?.(reorder.sourceId, reorder.targetId, reorder.position)
    }
  }

  return (
    <svg
      ref={svgRef}
      className={`figure-svg${dragVisual ? ' is-panel-dragging' : ''} ${className}`}
      viewBox={`0 0 ${solved.width} ${solved.height}`}
      role="img"
      aria-label="科研多面板图片预览"
      data-testid="figure-canvas"
    >
      {project.style.background !== 'transparent' && (
        <rect width="100%" height="100%" fill="#ffffff" />
      )}
      <defs>
        {solved.frames.map((frame) => (
          <clipPath
            id={`${instanceId}-clip-${frame.assetId}`}
            key={frame.assetId}
          >
            <rect
              x={frame.x}
              y={frame.y}
              width={frame.width}
              height={frame.height}
            />
          </clipPath>
        ))}
      </defs>
      {solved.frames.map((frame) => {
        const asset = assetMap.get(frame.assetId)
        const panel = project.panels[frame.assetId]
        if (!asset || !panel) return null
        const rect = getImageRenderRect(frame, asset, panel)
        const index = project.panelOrder.indexOf(asset.id)
        const label = getPanelLabel(
          index,
          project.style.labelMode,
          project.style.labelParentheses,
        )
        const placement = getLabelPlacement(frame, project.style)

        return (
          <g
            key={frame.assetId}
            className={`figure-panel${interactive ? ' is-interactive' : ''}${
              dragVisual?.sourceId === frame.assetId ? ' is-drag-source' : ''
            }`}
            data-panel-id={frame.assetId}
          >
            <image
              href={asset.previewUrl}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              clipPath={`url(#${instanceId}-clip-${frame.assetId})`}
              preserveAspectRatio="none"
            />
            {label && !panel.hiddenLabel && (
              <text
                x={placement.x}
                y={placement.y}
                textAnchor={placement.textAnchor}
                fontFamily={placement.fontFamily}
                fontSize={project.style.labelSize}
                fontWeight={placement.fontWeight}
                fill={project.style.labelColor}
                stroke="#ffffff"
                strokeWidth={project.style.labelSize * 0.1}
                paintOrder="stroke fill"
              >
                {label}
              </text>
            )}
            {interactive && (
              <rect
                x={frame.x}
                y={frame.y}
                width={frame.width}
                height={frame.height}
                className={
                  `panel-hitbox${
                    selectedAssetId === frame.assetId ? ' is-selected' : ''
                  }${
                    dragVisual?.targetId === frame.assetId
                      ? ' is-drop-target'
                      : ''
                  }`
                }
                onPointerDown={(event) => handlePointerDown(event, frame.assetId)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={clearPointerDrag}
              />
            )}
            {interactive && dragVisual?.targetId === frame.assetId && (
              <g className="panel-drop-indicator" pointerEvents="none">
                <line
                  className="panel-drop-line-halo"
                  x1={dragVisual.position === 'before' ? frame.x : frame.x + frame.width}
                  x2={dragVisual.position === 'before' ? frame.x : frame.x + frame.width}
                  y1={frame.y}
                  y2={frame.y + frame.height}
                />
                <line
                  className="panel-drop-line"
                  x1={dragVisual.position === 'before' ? frame.x : frame.x + frame.width}
                  x2={dragVisual.position === 'before' ? frame.x : frame.x + frame.width}
                  y1={frame.y}
                  y2={frame.y + frame.height}
                />
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
