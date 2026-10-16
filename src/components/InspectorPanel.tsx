import type { ReactNode } from 'react'
import { EXPORT_WIDTH_PRESETS } from '../constants'
import {
  LABEL_FONT_OPTIONS,
  LABEL_POSITION_OPTIONS,
  getLabelFontFamily,
} from '../lib/labels'
import type {
  ExportSettings,
  FigureStyle,
  ImageAsset,
  PanelState,
} from '../types'
import type { FolderBackupController } from '../hooks/useFolderBackup'
import type {
  EditorSectionId,
  EditorSectionState,
} from '../hooks/useEditorSections'
import { CollapsibleSection } from './CollapsibleSection'

interface InspectorPanelProps {
  stylePresets: ReactNode
  selectedAsset: ImageAsset | null
  selectedPanel: PanelState | null
  style: FigureStyle
  exportSettings: ExportSettings
  estimatedHeight: number
  canExport: boolean
  busyAction: string | null
  onPanelChange: (patch: Partial<PanelState>) => void
  onStyleChange: (patch: Partial<FigureStyle>) => void
  onExportChange: (patch: Partial<ExportSettings>) => void
  onExportPng: () => void
  onExportSvg: () => void
  onExportTiff: () => void
  folderBackup: FolderBackupController
  onOpenBackupSettings: () => void
  sectionState: EditorSectionState
  onToggleSection: (sectionId: EditorSectionId) => void
}

function RangeRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  disabled = false,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className={`range-row${disabled ? ' is-disabled' : ''}`}>
      <span>
        {label}
        <output>{value}{unit}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export function InspectorPanel({
  stylePresets,
  selectedAsset,
  selectedPanel,
  style,
  exportSettings,
  estimatedHeight,
  canExport,
  busyAction,
  onPanelChange,
  onStyleChange,
  onExportChange,
  onExportPng,
  onExportSvg,
  onExportTiff,
  folderBackup,
  onOpenBackupSettings,
  sectionState,
  onToggleSection,
}: InspectorPanelProps) {
  const backupStatusText = {
    unsupported: '当前环境不支持',
    disabled: '未启用',
    'needs-permission': '需要重新授权',
    idle: '已备份',
    scheduled: '等待备份',
    writing: '正在备份…',
    error: '备份失败',
  }[folderBackup.status]
  const labelExample = style.labelMode === 'lowercase' ? 'a' : 'A'

  return (
    <aside className="sidebar inspector-sidebar" aria-label="排版设置">
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow">微调</span>
          <h2>排版设置</h2>
        </div>
      </div>

      {stylePresets}

      <CollapsibleSection
        sectionId="panel"
        title="当前面板"
        summary={selectedAsset?.name}
        headingLevel={3}
        open={sectionState.panel}
        className="inspector-section"
        onToggle={onToggleSection}
      >
        {!selectedAsset || !selectedPanel ? (
          <p className="muted-copy">在画布或左侧列表中选择一张图片。</p>
        ) : (
          <>
            <div className="segmented-control">
              <button
                type="button"
                className={selectedPanel.fit === 'contain' ? 'is-active' : ''}
                onClick={() =>
                  onPanelChange({ fit: 'contain', zoom: 1, offsetX: 0, offsetY: 0 })
                }
              >
                完整显示
              </button>
              <button
                type="button"
                className={selectedPanel.fit === 'cover' ? 'is-active' : ''}
                onClick={() => onPanelChange({ fit: 'cover' })}
              >
                铺满裁剪
              </button>
            </div>
            <RangeRow
              label="缩放"
              value={selectedPanel.zoom}
              min={0.25}
              max={3}
              step={0.05}
              unit="×"
              onChange={(zoom) => onPanelChange({ zoom })}
            />
            <RangeRow
              label="水平焦点"
              value={Math.round(selectedPanel.offsetX * 100)}
              min={-100}
              max={100}
              unit="%"
              disabled={selectedPanel.fit !== 'cover'}
              onChange={(offsetX) => onPanelChange({ offsetX: offsetX / 100 })}
            />
            <RangeRow
              label="垂直焦点"
              value={Math.round(selectedPanel.offsetY * 100)}
              min={-100}
              max={100}
              unit="%"
              disabled={selectedPanel.fit !== 'cover'}
              onChange={(offsetY) => onPanelChange({ offsetY: offsetY / 100 })}
            />
            <label className="check-row">
              <input
                type="checkbox"
                checked={selectedPanel.hiddenLabel}
                onChange={(event) =>
                  onPanelChange({ hiddenLabel: event.target.checked })
                }
              />
              隐藏该面板标签
            </label>
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        sectionId="canvas"
        title="画布"
        summary={`${style.gap}px 间距`}
        headingLevel={3}
        open={sectionState.canvas}
        className="inspector-section"
        onToggle={onToggleSection}
      >
        <RangeRow
          label="图片间距"
          value={style.gap}
          min={0}
          max={64}
          unit=" px"
          onChange={(gap) => onStyleChange({ gap })}
        />
        <RangeRow
          label="外边距"
          value={style.padding}
          min={0}
          max={64}
          unit=" px"
          onChange={(padding) => onStyleChange({ padding })}
        />
        <span className="field-label">背景</span>
        <div className="segmented-control">
          <button
            type="button"
            className={style.background === '#ffffff' ? 'is-active' : ''}
            onClick={() => onStyleChange({ background: '#ffffff' })}
          >
            白色
          </button>
          <button
            type="button"
            className={style.background === 'transparent' ? 'is-active' : ''}
            onClick={() => onStyleChange({ background: 'transparent' })}
          >
            透明
          </button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        sectionId="labels"
        title="面板标签"
        summary={`${style.labelParentheses ? `(${labelExample})` : labelExample} · ${style.labelSize}px`}
        headingLevel={3}
        open={sectionState.labels}
        className="inspector-section"
        onToggle={onToggleSection}
      >
        <div className="field-grid two-columns">
          <label>
            <span>样式</span>
            <select
              value={style.labelMode}
              onChange={(event) =>
                onStyleChange({
                  labelMode: event.target.value as FigureStyle['labelMode'],
                })
              }
            >
              <option value="uppercase">A, B, C</option>
              <option value="lowercase">a, b, c</option>
              <option value="none">不显示</option>
            </select>
          </label>
          <label>
            <span>字体</span>
            <select
              value={style.labelFont}
              onChange={(event) =>
                onStyleChange({
                  labelFont: event.target.value as FigureStyle['labelFont'],
                })
              }
            >
              {LABEL_FONT_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className="field-label">括号样式</span>
        <div className="segmented-control">
          <button
            type="button"
            className={!style.labelParentheses ? 'is-active' : ''}
            aria-label="标签不使用括号"
            onClick={() => onStyleChange({ labelParentheses: false })}
          >
            {labelExample}
          </button>
          <button
            type="button"
            className={style.labelParentheses ? 'is-active' : ''}
            aria-label="标签使用括号"
            onClick={() => onStyleChange({ labelParentheses: true })}
          >
            ({labelExample})
          </button>
        </div>
        <span className="field-label">位置</span>
        <div className="label-position-grid">
          {LABEL_POSITION_OPTIONS.map((option) => (
            <button
              type="button"
              className={style.labelPosition === option.value ? 'is-active' : ''}
              onClick={() => onStyleChange({ labelPosition: option.value })}
              aria-label={`标签位置：${option.label}`}
              key={option.value}
            >
              <i />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <span className="field-label">字重</span>
        <div className="segmented-control">
          {([400, 600, 700] as const).map((weight) => (
            <button
              type="button"
              className={style.labelWeight === weight ? 'is-active' : ''}
              onClick={() => onStyleChange({ labelWeight: weight })}
              key={weight}
            >
              {weight === 400 ? '常规' : weight === 600 ? '半粗' : '粗体'}
            </button>
          ))}
        </div>
        <RangeRow
          label="字号"
          value={style.labelSize}
          min={18}
          max={64}
          unit=" px"
          onChange={(labelSize) => onStyleChange({ labelSize })}
        />
        <RangeRow
          label="标签水平位置"
          value={style.labelOffsetX}
          min={-120}
          max={120}
          unit=" px"
          onChange={(labelOffsetX) => onStyleChange({ labelOffsetX })}
        />
        <RangeRow
          label="标签垂直位置"
          value={style.labelOffsetY}
          min={-120}
          max={120}
          unit=" px"
          onChange={(labelOffsetY) => onStyleChange({ labelOffsetY })}
        />
        <p className="muted-copy">负值将标签向面板外移动，正值向内移动；靠近画布边缘时可增大外边距，避免标签被截断。</p>
        <div
          className="label-font-preview"
          style={{
            color: style.labelColor,
            fontFamily: getLabelFontFamily(style.labelFont),
            fontWeight: style.labelWeight,
          }}
          aria-label="标签字体预览"
        >
          {style.labelParentheses ? '(Aa) (Bb) (Cc)' : 'Aa Bb Cc'}
        </div>
        <label className="color-row">
          <span>颜色</span>
          <input
            type="color"
            value={style.labelColor}
            onChange={(event) => onStyleChange({ labelColor: event.target.value })}
          />
          <code>{style.labelColor.toUpperCase()}</code>
        </label>
      </CollapsibleSection>

      <CollapsibleSection
        sectionId="export"
        title="导出"
        summary={canExport
          ? `${exportSettings.width} × ${estimatedHeight}px`
          : undefined}
        headingLevel={3}
        open={sectionState.export}
        className="inspector-section export-section"
        onToggle={onToggleSection}
      >
        <div className="preset-row">
          {EXPORT_WIDTH_PRESETS.map((width) => (
            <button
              type="button"
              className={exportSettings.width === width ? 'is-active' : ''}
              onClick={() => onExportChange({ width })}
              key={width}
            >
              {width}
            </button>
          ))}
        </div>
        <label className="number-field">
          <span>自定义宽度</span>
          <input
            type="number"
            min={500}
            max={10000}
            step={100}
            value={exportSettings.width}
            onChange={(event) => {
              const width = Number(event.target.value)
              if (Number.isFinite(width)) onExportChange({ width })
            }}
            onBlur={(event) =>
              onExportChange({
                width: Math.min(10000, Math.max(500, Number(event.target.value) || 3000)),
              })
            }
          />
          <small>500–10000 px</small>
        </label>
        <button
          type="button"
          className="primary-button export-button"
          onClick={onExportPng}
          disabled={!canExport || busyAction !== null}
        >
          {busyAction === 'png' ? '正在生成 PNG…' : '导出高清 PNG'}
        </button>
        <button
          type="button"
          className="secondary-button export-button"
          onClick={onExportTiff}
          disabled={!canExport || busyAction !== null}
        >
          {busyAction === 'tiff' ? '正在生成 TIFF…' : '导出高清 TIFF'}
        </button>
        <button
          type="button"
          className="secondary-button export-button"
          onClick={onExportSvg}
          disabled={!canExport || busyAction !== null}
        >
          {busyAction === 'svg' ? '正在生成 SVG…' : '导出可编辑 SVG'}
        </button>
      </CollapsibleSection>

      <CollapsibleSection
        sectionId="backup"
        title="文件夹备份"
        summary={(
          <span className={`backup-status backup-status-${folderBackup.status}`}>
            <i />{backupStatusText}
          </span>
        )}
        headingLevel={3}
        open={sectionState.backup}
        className="inspector-section backup-section"
        onToggle={onToggleSection}
      >
        {!folderBackup.loaded ? (
          <p className="muted-copy">正在读取备份设置…</p>
        ) : !folderBackup.supported ? (
          <div className="backup-unavailable">
            <strong>需要 HTTPS 和 Chrome / Edge</strong>
            <p>当前工程仍会保存到浏览器，也可以手动下载 .figgrid。</p>
          </div>
        ) : (
          <>
            {folderBackup.rootFolderName ? (
              <div className="backup-folder-card">
                <span aria-hidden="true">⌂</span>
                <div>
                  <strong>{folderBackup.rootFolderName}</strong>
                  <small>
                    {folderBackup.projectFolderName
                      ? `${folderBackup.projectFolderName}/latest.figgrid`
                      : '将在首次写入时创建工程目录'}
                  </small>
                </div>
              </div>
            ) : (
              <p className="muted-copy">
                尚未配置磁盘备份，工程仍会自动保存到浏览器。
              </p>
            )}

            {folderBackup.lastBackupAt && (
              <p className="backup-time">
                最近备份：{new Date(folderBackup.lastBackupAt).toLocaleString('zh-CN')}
              </p>
            )}
            {folderBackup.error && (
              <p className="backup-error" role="alert">{folderBackup.error}</p>
            )}

            {folderBackup.enabled && folderBackup.permission === 'granted' && (
              <button
                type="button"
                className="primary-button backup-main-button"
                onClick={() => void folderBackup.backupNow()}
                disabled={folderBackup.status === 'writing'}
              >
                {folderBackup.status === 'writing' ? '正在备份…' : '立即备份'}
              </button>
            )}
            <button
              type="button"
              className="secondary-button backup-settings-button"
              onClick={onOpenBackupSettings}
            >
              {folderBackup.status === 'needs-permission'
                ? '前往设置重新授权'
                : '前往通用设置'}
            </button>
          </>
        )}
        {!folderBackup.supported && (
          <button
            type="button"
            className="secondary-button backup-settings-button"
            onClick={onOpenBackupSettings}
          >
            查看通用设置
          </button>
        )}
      </CollapsibleSection>
    </aside>
  )
}
