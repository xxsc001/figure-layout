import { useEffect, useRef, useState } from 'react'
import type { BridgeImportParams } from '../lib/bridge-import'
import {
  completeBridgeImport,
  fetchBridgeProject,
} from '../lib/bridge-import'
import { readFiggridBundle } from '../lib/project-file'
import { copyProjectAsNew } from '../lib/project'
import { saveProject, setLastOpenProjectId } from '../lib/storage'

interface BridgeImportPageProps {
  params: BridgeImportParams | null
  initialError: string | null
  onOpenProject: (projectId: string) => void
  onProjects: () => void
}

export function BridgeImportPage({
  params,
  initialError,
  onOpenProject,
  onProjects,
}: BridgeImportPageProps) {
  const [state, setState] = useState<'loading' | 'error'>
    (initialError || !params ? 'error' : 'loading')
  const [message, setMessage] = useState(
    initialError || '正在从 Origin 批量排版助手接收工程…',
  )
  const inputRef = useRef<HTMLInputElement>(null)

  const importProject = async (file: File) => {
    const restored = await readFiggridBundle(file)
    try {
      const imported = copyProjectAsNew(restored)
      await saveProject(imported)
      await setLastOpenProjectId(imported.id)
      onOpenProject(imported.id)
    } finally {
      restored.assets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl))
    }
  }

  useEffect(() => {
    if (!params || initialError) return
    let cancelled = false
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}#/bridge-import`,
    )
    fetchBridgeProject(params)
      .then(async (file) => {
        if (cancelled) return
        await importProject(file)
        await completeBridgeImport(params)
      })
      .catch((error) => {
        if (cancelled) return
        setState('error')
        setMessage(error instanceof Error ? error.message : 'Origin 工程导入失败。')
      })
    return () => {
      cancelled = true
    }
  // Import exactly once for the token captured by the route.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialError, params?.port, params?.token])

  const importFallback = async (file: File) => {
    setState('loading')
    setMessage('正在打开 selected.figgrid…')
    try {
      await importProject(file)
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : '工程文件无法导入。')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <main className="bridge-import-page">
      <section className="bridge-import-card" aria-live="polite">
        <div className={`bridge-import-icon${state === 'error' ? ' is-error' : ''}`}>
          {state === 'loading' ? <span /> : '!' }
        </div>
        <span className="eyebrow">ORIGIN BRIDGE</span>
        <h1>{state === 'loading' ? '正在创建排版工程' : '自动导入没有完成'}</h1>
        <p>{message}</p>
        {state === 'error' && (
          <div className="bridge-import-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => inputRef.current?.click()}
            >
              手动导入 selected.figgrid
            </button>
            <button type="button" onClick={onProjects}>返回我的工程</button>
            <input
              ref={inputRef}
              type="file"
              accept=".figgrid,application/x-figgrid"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importFallback(file)
              }}
            />
          </div>
        )}
        <small>图片仅在 Origin、助手和当前浏览器之间传递，不会上传。</small>
      </section>
    </main>
  )
}
