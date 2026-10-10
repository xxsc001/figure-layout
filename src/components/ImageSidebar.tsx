import { useRef, useState } from 'react'
import { MAX_PANEL_COUNT } from '../constants'
import type { EditorSectionId } from '../hooks/useEditorSections'
import type { ImageAsset } from '../types'
import { getPanelLabel } from '../lib/geometry'
import { CollapsibleSection } from './CollapsibleSection'

interface ImageSidebarProps {
  assets: ImageAsset[]
  selectedAssetId: string | null
  onFiles: (files: File[]) => void
  onSelect: (assetId: string) => void
  onRemove: (assetId: string) => void
  onReplace: (assetId: string, file: File) => void
  onReorder: (draggedId: string, targetId: string) => void
  onMove: (assetId: string, direction: -1 | 1) => void
  sectionOpen: boolean
  onToggleSection: (sectionId: EditorSectionId) => void
}

function formatBytes(size: number) {
  return `${(size / 1024 / 1024).toFixed(size >= 10 * 1024 * 1024 ? 1 : 2)} MB`
}

export function ImageSidebar({
  assets,
  selectedAssetId,
  onFiles,
  onSelect,
  onRemove,
  onReplace,
  onReorder,
  onMove,
  sectionOpen,
  onToggleSection,
}: ImageSidebarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropActive, setDropActive] = useState(false)

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return
    onFiles(Array.from(list))
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <aside className="sidebar asset-sidebar" aria-label="图片列表">
      <CollapsibleSection
        sectionId="assets"
        title="图片面板"
        eyebrow="素材"
        summary={(
          <span className="count-badge">
            {assets.length}/{MAX_PANEL_COUNT}
          </span>
        )}
        open={sectionOpen}
        className="asset-section"
        onToggle={onToggleSection}
      >
        <button
        type="button"
        className={`dropzone${dropActive ? ' is-active' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault()
          setDropActive(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDropActive(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDropActive(false)
          addFiles(event.dataTransfer.files)
        }}
        >
          <span className="dropzone-icon" aria-hidden="true">＋</span>
          <strong>添加图片</strong>
          <small>拖到这里，或点击选择</small>
          <small>PNG · JPG · WebP</small>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          multiple
          hidden
          onChange={(event) => addFiles(event.target.files)}
          data-testid="image-input"
        />

        {assets.length === 0 ? (
          <div className="sidebar-empty">
            <p>尚未导入图片</p>
            <span>先添加 2–12 张已导出的科研图片。</span>
          </div>
        ) : (
          <ol className="asset-list">
            {assets.map((asset, index) => (
            <li
              className={`asset-card${
                selectedAssetId === asset.id ? ' is-selected' : ''
              }${draggedId === asset.id ? ' is-dragging' : ''}`}
              key={asset.id}
              draggable
              onDragStart={() => setDraggedId(asset.id)}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                event.stopPropagation()
                if (draggedId && draggedId !== asset.id) {
                  onReorder(draggedId, asset.id)
                }
                setDraggedId(null)
              }}
            >
              <button
                type="button"
                className="asset-main"
                onClick={() => onSelect(asset.id)}
              >
                <span className="asset-label">
                  {getPanelLabel(index, 'uppercase')}
                </span>
                <span className="asset-thumbnail checkerboard">
                  <img src={asset.previewUrl} alt="" />
                </span>
                <span className="asset-meta">
                  <strong title={asset.name}>{asset.name}</strong>
                  <small>
                    {asset.width} × {asset.height} · {formatBytes(asset.size)}
                  </small>
                </span>
              </button>
              <div className="asset-actions">
                <button
                  type="button"
                  onClick={() => onMove(asset.id, -1)}
                  disabled={index === 0}
                  aria-label={`上移 ${asset.name}`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMove(asset.id, 1)}
                  disabled={index === assets.length - 1}
                  aria-label={`下移 ${asset.name}`}
                >
                  ↓
                </button>
                <label className="text-button" title="替换图片">
                  换
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) onReplace(asset.id, file)
                      event.target.value = ''
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onRemove(asset.id)}
                  aria-label={`删除 ${asset.name}`}
                  className="danger-action"
                >
                  ×
                </button>
              </div>
            </li>
            ))}
          </ol>
        )}
        <p className="privacy-note">图片只在当前浏览器中处理，不会上传。</p>
      </CollapsibleSection>
    </aside>
  )
}
