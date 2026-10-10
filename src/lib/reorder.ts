export type ReorderPosition = 'before' | 'after'

export function reorderPanelOrder(
  order: string[],
  draggedId: string,
  targetId: string,
  position: ReorderPosition,
) {
  if (draggedId === targetId) return order
  if (!order.includes(draggedId) || !order.includes(targetId)) return order

  const next = order.filter((id) => id !== draggedId)
  const targetIndex = next.indexOf(targetId)
  const insertionIndex = targetIndex + (position === 'after' ? 1 : 0)
  next.splice(insertionIndex, 0, draggedId)

  return next.every((id, index) => id === order[index]) ? order : next
}
