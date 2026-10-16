import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { FigureProjectV2, SolvedLayout } from '../types'
import type { ReorderPosition } from '../lib/reorder'
import { FigureCanvas } from './FigureCanvas'

type ViewProps = {
  project: FigureProjectV2
  solved: SolvedLayout
  selectedAssetId?: string | null
  onSelect?: (id: string) => void
  onReorder?: (source: string, target: string, position: ReorderPosition) => void
}
type ExportProps = {
  onExportPng: () => void
  onExportTiff: () => void
  onExportSvg: () => void
  busy: boolean
}

function CanvasViewport({ project, solved, selectedAssetId, onSelect, onReorder, final = false, actions }: ViewProps & { final?: boolean; actions?: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const [scale, setScale] = useState(1)
  const fit = useCallback(() => {
    const element = viewport.current
    if (!element || element.clientWidth <= 48 || element.clientHeight <= 48) return
    setScale(Math.max(0.01, Math.min(1, (element.clientWidth - 48) / solved.width, (element.clientHeight - 48) / solved.height)))
    element.scrollTo?.(0, 0)
  }, [solved.width, solved.height])
  useLayoutEffect(() => {
    const initialize = () => {
      const element = viewport.current
      if (!initialized.current && element && element.clientWidth > 48 && element.clientHeight > 48) {
        initialized.current = true
        fit()
      }
    }
    initialize()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(initialize)
    if (viewport.current) observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [fit])
  return <>
    <div className="preview-toolbar" aria-label={final ? '成品预览工具' : '编辑预览工具'}>
      <button type="button" className="secondary-button" onClick={fit}>适应窗口</button>
      <button type="button" className="secondary-button" onClick={() => setScale(1)}>100%</button>
      <button type="button" className="secondary-button preview-zoom" aria-label="缩小预览" onClick={() => setScale(value => Math.max(0.01, value / 1.2))}>−</button>
      <output aria-label="预览缩放比例">{Math.round(scale * 100)}%</output>
      <button type="button" className="secondary-button preview-zoom" aria-label="放大预览" onClick={() => setScale(value => Math.min(4, value * 1.2))}>＋</button>
      {actions}
    </div>
    <div ref={viewport} className={'canvas-frame workspace-viewport' + (project.style.background === 'transparent' ? ' checkerboard' : '')}>
      <FigureCanvas project={project} solved={solved} previewScale={scale} interactive={!final} selectedAssetId={final ? null : selectedAssetId} onSelect={final ? undefined : onSelect} onReorder={final ? undefined : onReorder} />
    </div>
  </>
}

function FinalPreview({ onClose, onExportPng, onExportTiff, onExportSvg, busy, ...view }: ViewProps & ExportProps & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  useLayoutEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  return <dialog ref={dialog} className="final-preview-dialog" aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose() }}>
    <header><h2 id={title}>成品预览</h2><button type="button" className="secondary-button" onClick={onClose} aria-label="关闭成品预览">关闭 ×</button></header>
    <CanvasViewport {...view} final />
    <footer><button type="button" className="primary-button" disabled={busy} onClick={onExportPng}>导出 PNG</button><button type="button" className="secondary-button" disabled={busy} onClick={onExportTiff}>导出 TIFF</button><button type="button" className="secondary-button" disabled={busy} onClick={onExportSvg}>导出 SVG</button></footer>
  </dialog>
}

export function FigureWorkspace({ onExportPng, onExportTiff, onExportSvg, busy, ...view }: ViewProps & ExportProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  return <>
    <CanvasViewport {...view} actions={<button type="button" className="primary-button" onClick={() => setPreviewOpen(true)}>成品预览</button>} />
    {previewOpen && <FinalPreview {...view} busy={busy} onClose={() => setPreviewOpen(false)} onExportPng={onExportPng} onExportTiff={onExportTiff} onExportSvg={onExportSvg} />}
  </>
}
