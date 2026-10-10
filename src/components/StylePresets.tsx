import { useState } from 'react'
import type { FigureProjectV2 } from '../types'
import { captureStylePreset, readStylePresets, writeStylePresets, type StylePreset } from '../lib/style-presets'

export function StylePresets({ project, onApply }: { project: FigureProjectV2; onApply: (preset: StylePreset) => void }) {
  const [initial] = useState(() => {
    try { return { presets: readStylePresets(), error: '' } }
    catch { return { presets: [] as StylePreset[], error: '无法读取常用样式，请检查浏览器存储。' } }
  })
  const [presets, setPresets] = useState(initial.presets)
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(initial.error)
  const selected = presets.find((preset) => preset.id === selectedId)

  const persist = (next: StylePreset[], success: string) => {
    try {
      writeStylePresets(next)
      setPresets(next)
      setError('')
      setMessage(success)
      return true
    } catch {
      setError('保存失败，请检查浏览器存储空间或权限。')
      setMessage('')
      return false
    }
  }

  const save = (overwrite: boolean) => {
    try {
      const preset = captureStylePreset(project, overwrite && selected ? selected.name : name, overwrite ? selected?.id : undefined)
      const next = overwrite ? presets.map((item) => item.id === preset.id ? preset : item) : [...presets, preset]
      if (persist(next, overwrite ? '常用样式已更新。' : '当前格式已保存。')) {
        setSelectedId(preset.id)
        setName('')
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败。') }
  }

  return (
    <section className="inspector-section style-presets" aria-label="常用样式">
      <h3>常用样式</h3>
      <div className="field-grid">
        <label>
          <span>已保存的样式</span>
          <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setMessage(''); setError('') }}>
            <option value="">{presets.length ? '请选择常用样式' : '暂无常用样式'}</option>
            {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
        </label>
      </div>
      <div className="preset-actions">
        <button type="button" className="secondary-button" disabled={!selected} onClick={() => { if (selected) { onApply(selected); setMessage('常用样式已应用。'); setError('') } }}>应用样式</button>
        <button type="button" className="secondary-button" disabled={!selected || !!initial.error} onClick={() => save(true)}>更新样式</button>
        <button type="button" className="secondary-button" disabled={!selected || !!initial.error} onClick={() => { if (persist(presets.filter((preset) => preset.id !== selectedId), '常用样式已删除。')) setSelectedId('') }}>删除样式</button>
      </div>
      <label className="number-field">
        <span>样式名称</span>
        <input type="text" maxLength={60} placeholder="例如：论文双栏" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <button type="button" className="primary-button export-button" disabled={!name.trim() || !!initial.error} onClick={() => save(false)}>保存当前格式为常用样式</button>
      {message && <p className="muted-copy" role="status">{message}</p>}
      {error && <p className="backup-error" role="alert">{error}</p>}
    </section>
  )
}
