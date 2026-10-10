import type {
  FigureStyle,
  LabelFont,
  LabelPosition,
  PanelFrame,
} from '../types'

export const LABEL_FONT_OPTIONS: Array<{ value: LabelFont; label: string }> = [
  { value: 'arial', label: 'Arial' },
  { value: 'times', label: 'Times New Roman' },
  { value: 'georgia', label: 'Georgia' },
  { value: 'verdana', label: 'Verdana' },
]

export const LABEL_POSITION_OPTIONS: Array<{
  value: LabelPosition
  label: string
}> = [
  { value: 'top-left', label: '左上角' },
  { value: 'top-right', label: '右上角' },
  { value: 'bottom-left', label: '左下角' },
  { value: 'bottom-right', label: '右下角' },
]

const FONT_FAMILIES: Record<LabelFont, string> = {
  arial: 'Arial, Helvetica, sans-serif',
  times: '"Times New Roman", Times, serif',
  georgia: 'Georgia, "Times New Roman", serif',
  verdana: 'Verdana, Arial, sans-serif',
}

export function getLabelFontFamily(font: LabelFont) {
  return FONT_FAMILIES[font]
}

export interface LabelPlacement {
  x: number
  y: number
  textAnchor: 'start' | 'end'
  fontFamily: string
  fontWeight: FigureStyle['labelWeight']
}

function clampOffset(value: number, available: number) {
  return Math.min(Math.max(-120, value), Math.max(0, available))
}

export function getLabelPlacement(
  frame: Pick<PanelFrame, 'x' | 'y' | 'width' | 'height'>,
  style: Pick<
    FigureStyle,
    | 'labelPosition'
    | 'labelFont'
    | 'labelWeight'
    | 'labelOffsetX'
    | 'labelOffsetY'
    | 'labelSize'
  >,
): LabelPlacement {
  const isLeft = style.labelPosition.endsWith('left')
  const isTop = style.labelPosition.startsWith('top')
  const offsetX = clampOffset(
    style.labelOffsetX,
    frame.width - style.labelSize * 0.9,
  )
  const offsetY = clampOffset(
    style.labelOffsetY,
    frame.height - style.labelSize,
  )

  return {
    x: isLeft ? frame.x + offsetX : frame.x + frame.width - offsetX,
    y: isTop
      ? frame.y + offsetY + style.labelSize * 0.72
      : frame.y + frame.height - offsetY - style.labelSize * 0.12,
    textAnchor: isLeft ? 'start' : 'end',
    fontFamily: getLabelFontFamily(style.labelFont),
    fontWeight: style.labelWeight,
  }
}
