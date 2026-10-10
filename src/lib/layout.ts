import { CANVAS_WIDTH } from '../constants'
import type {
  FigureStyle,
  ImageAsset,
  LayoutCandidate,
  LayoutKind,
  LayoutProfile,
  PanelFrame,
  SolvedLayout,
} from '../types'

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

function displayAspect(asset: ImageAsset) {
  return clamp(asset.width / asset.height, 0.4, 3)
}

function coefficientOfVariation(values: number[]) {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  if (mean === 0) return 0
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length
  return Math.sqrt(variance) / mean
}

export function enumerateRowPartitions(
  total: number,
  maxPerRow = 4,
): number[][] {
  const results: number[][] = []
  const visit = (remaining: number, current: number[]) => {
    if (remaining === 0) {
      results.push(current)
      return
    }
    for (let count = 1; count <= Math.min(maxPerRow, remaining); count += 1) {
      visit(remaining - count, [...current, count])
    }
  }
  visit(total, [])
  return results
}

function getRowAssets(assets: ImageAsset[], rows: number[]) {
  let cursor = 0
  return rows.map((count) => {
    const row = assets.slice(cursor, cursor + count)
    cursor += count
    return row
  })
}

function justifiedMetrics(assets: ImageAsset[], rows: number[]) {
  const rowAssets = getRowAssets(assets, rows)
  const contentWidth = 1000
  const gap = 16
  const rowHeights = rowAssets.map((row) => {
    const aspectSum = row.reduce(
      (sum, asset) => sum + displayAspect(asset),
      0,
    )
    return (contentWidth - gap * (row.length - 1)) / aspectSum
  })
  const totalHeight =
    rowHeights.reduce((sum, height) => sum + height, 0) +
    gap * Math.max(0, rows.length - 1)
  const areas = rowAssets.flatMap((row, rowIndex) =>
    row.map(
      (asset) => displayAspect(asset) * rowHeights[rowIndex] ** 2,
    ),
  )
  const orphanPenalty = rows.reduce(
    (sum, count, index) =>
      sum +
      (count === 1 && assets.length > 2
        ? index === rows.length - 1
          ? 1.4
          : 1
        : 0),
    0,
  )
  return {
    overallRatio: contentWidth / totalHeight,
    rowVariation: coefficientOfVariation(rowHeights),
    areaVariation: coefficientOfVariation(areas),
    orphanPenalty,
  }
}

function scorePartition(
  assets: ImageAsset[],
  rows: number[],
  profile: Exclude<LayoutProfile, 'classic'>,
) {
  const metrics = justifiedMetrics(assets, rows)
  const spread = Math.max(...rows) - Math.min(...rows)
  if (profile === 'compact') {
    return (
      Math.abs(Math.log(metrics.overallRatio / 1.35)) * 1.5 +
      metrics.rowVariation * 0.8 +
      metrics.areaVariation * 0.4 +
      metrics.orphanPenalty * 1.2 +
      rows.length * 0.04
    )
  }
  return (
    Math.abs(Math.log(metrics.overallRatio)) * 1.2 +
    metrics.rowVariation * 1.8 +
    metrics.areaVariation +
    metrics.orphanPenalty * 2 +
    spread * 0.15
  )
}

function classicOptions(assets: ImageAsset[]) {
  const count = assets.length
  return [1, 2, 3, 4]
    .filter((columns) => columns <= count)
    .map((columns) => {
      const rows: number[] = []
      let remaining = count
      while (remaining > 0) {
        rows.push(Math.min(columns, remaining))
        remaining -= columns
      }
      const rowCount = rows.length
      const orphan = rows.at(-1) === 1 && count > 2 ? 1 : 0
      const gridRatio = columns / rowCount
      const emptyCells = columns * rowCount - count
      const score =
        Math.abs(Math.log(gridRatio / 1.2)) +
        orphan * 0.9 +
        emptyCells * 0.12
      return { rows, score }
    })
    .sort((a, b) => a.score - b.score)
}

function candidateSignature(kind: LayoutKind, rows: number[]) {
  return `${kind}:${rows.join('-')}`
}

export function generateLayoutCandidates(
  orderedAssets: ImageAsset[],
): LayoutCandidate[] {
  if (orderedAssets.length < 2) return []

  const results: LayoutCandidate[] = []
  const signatures = new Set<string>()
  const add = (
    profile: LayoutProfile,
    name: string,
    description: string,
    kind: LayoutKind,
    rows: number[],
    score: number,
  ) => {
    const signature = candidateSignature(kind, rows)
    if (signatures.has(signature)) return false
    signatures.add(signature)
    results.push({
      id: profile,
      profile,
      name,
      description,
      kind,
      rows,
      score,
    })
    return true
  }

  const [classic] = classicOptions(orderedAssets)
  add(
    'classic',
    '经典网格',
    `${classic.rows.length} 行等尺寸面板`,
    'equal-grid',
    classic.rows,
    classic.score,
  )

  const partitions = enumerateRowPartitions(orderedAssets.length).filter(
    (rows) => rows.length <= 6,
  )
  const compact = partitions
    .map((rows) => ({
      rows,
      score: scorePartition(orderedAssets, rows, 'compact'),
    }))
    .sort((a, b) => a.score - b.score)
  const balanced = partitions
    .map((rows) => ({
      rows,
      score: scorePartition(orderedAssets, rows, 'balanced'),
    }))
    .sort((a, b) => a.score - b.score)

  const compactChoice = compact.find(
    ({ rows }) => !signatures.has(candidateSignature('justified', rows)),
  )
  if (compactChoice) {
    add(
      'compact',
      '紧凑自适应',
      '按原图比例压缩留白',
      'justified',
      compactChoice.rows,
      compactChoice.score,
    )
  }

  const balancedChoice = balanced.find(
    ({ rows }) => !signatures.has(candidateSignature('justified', rows)),
  )
  if (balancedChoice) {
    add(
      'balanced',
      '均衡布局',
      '优先保持各面板面积接近',
      'justified',
      balancedChoice.rows,
      balancedChoice.score,
    )
  }

  for (const fallback of classicOptions(orderedAssets).slice(1)) {
    if (results.length >= 3) break
    add(
      'balanced',
      '均衡布局',
      '另一种规则网格方向',
      'equal-grid',
      fallback.rows,
      fallback.score,
    )
  }

  return results.slice(0, 3)
}

export function solveLayout(
  candidate: LayoutCandidate,
  orderedAssets: ImageAsset[],
  style: FigureStyle,
): SolvedLayout {
  const contentWidth = CANVAS_WIDTH - style.padding * 2
  const frames: PanelFrame[] = []
  const rowAssets = getRowAssets(orderedAssets, candidate.rows)
  let y = style.padding

  if (candidate.kind === 'equal-grid') {
    const columns = Math.max(...candidate.rows)
    const cellWidth =
      (contentWidth - style.gap * (columns - 1)) / columns
    const sortedAspects = orderedAssets
      .map(displayAspect)
      .sort((a, b) => a - b)
    const medianAspect =
      sortedAspects[Math.floor(sortedAspects.length / 2)] ?? 1
    const cellHeight = cellWidth / clamp(medianAspect, 0.75, 1.6)
    rowAssets.forEach((row, rowIndex) => {
      const rowWidth =
        row.length * cellWidth + (row.length - 1) * style.gap
      let x = style.padding + (contentWidth - rowWidth) / 2
      row.forEach((asset, columnIndex) => {
        frames.push({
          assetId: asset.id,
          x,
          y,
          width: cellWidth,
          height: cellHeight,
          rowIndex,
          columnIndex,
        })
        x += cellWidth + style.gap
      })
      y += cellHeight + style.gap
    })
  } else {
    rowAssets.forEach((row, rowIndex) => {
      const aspectSum = row.reduce(
        (sum, asset) => sum + displayAspect(asset),
        0,
      )
      const rowHeight =
        (contentWidth - style.gap * Math.max(0, row.length - 1)) /
        aspectSum
      let x = style.padding
      row.forEach((asset, columnIndex) => {
        const width = displayAspect(asset) * rowHeight
        frames.push({
          assetId: asset.id,
          x,
          y,
          width,
          height: rowHeight,
          rowIndex,
          columnIndex,
        })
        x += width + style.gap
      })
      y += rowHeight + style.gap
    })
  }

  return {
    width: CANVAS_WIDTH,
    height: Math.max(1, y - style.gap + style.padding),
    frames,
  }
}
