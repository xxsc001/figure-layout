import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CandidatePicker } from './components/CandidatePicker'
import { BridgeImportPage } from './components/BridgeImportPage'
import { CollapsibleSection } from './components/CollapsibleSection'
import { DashboardShell } from './components/DashboardShell'
import { FigureCanvas } from './components/FigureCanvas'
import { GeneralSettingsPage } from './components/GeneralSettingsPage'
import { ImageSidebar } from './components/ImageSidebar'
import { useAutomaticWorkspaceBackup, useWorkspaceBackupStatus } from './hooks/useWorkspaceBackup'
import { StylePresets } from './components/StylePresets'
import { applyStylePreset } from './lib/style-presets'
import { InspectorPanel } from './components/InspectorPanel'
import { LandingPage } from './components/LandingPage'
import { ProjectsPage } from './components/ProjectsPage'
import { MIN_PANEL_COUNT } from './constants'
import { useProjectHistory } from './hooks/useProjectHistory'
import { useFolderBackup } from './hooks/useFolderBackup'
import { useEditorSections } from './hooks/useEditorSections'
import {
  parseBridgeImportHash,
  type BridgeImportParams,
} from './lib/bridge-import'
import { createPngBlob, createSvgBlob, createTiffBlob, downloadBlob } from './lib/export'
import { importImageFiles, replaceImageFile } from './lib/images'
import { generateLayoutCandidates, solveLayout } from './lib/layout'
import { reorderPanelOrder, type ReorderPosition } from './lib/reorder'
import {
  copyProjectAsNew,
  createEmptyProject,
  defaultPanelState,
  normalizeProjectTitle,
  projectFileName,
} from './lib/project'
import { createFiggridBundle, readFiggridBundle } from './lib/project-file'
import {
  getLastOpenProjectId,
  loadProject,
  saveProject,
  saveProjectThumbnail,
  setLastOpenProjectId,
} from './lib/storage'
import { createProjectThumbnail } from './lib/thumbnail'
import type {
  FigureProjectV2,
  FigureStyle,
  LayoutCandidate,
  PanelState,
} from './types'

interface Notice {
  type: 'error' | 'success' | 'info'
  text: string
}

function revokeProjectUrls(project: FigureProjectV2) {
  project.assets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl))
}

interface EditorAppProps {
  projectId: string
  onProjects: () => void
  onSettings: () => void
  onOpenProject: (projectId: string) => void
}

function EditorApp({
  projectId,
  onProjects,
  onSettings,
  onOpenProject,
}: EditorAppProps) {
  const {
    project,
    commit,
    replace,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useProjectHistory(createEmptyProject())
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [saveStatus, setSaveStatus] = useState('准备就绪')
  const projectInputRef = useRef<HTMLInputElement>(null)
  const folderBackup = useFolderBackup(project, hydrated)
  const { sections: editorSections, toggleSection } = useEditorSections()
  const latestProjectRef = useRef(project)
  latestProjectRef.current = project

  const orderedAssets = useMemo(() => {
    const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]))
    return project.panelOrder
      .map((id) => assetMap.get(id))
      .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
  }, [project.assets, project.panelOrder])

  const candidates = useMemo(
    () => generateLayoutCandidates(orderedAssets),
    [orderedAssets],
  )
  const solvedCandidates = useMemo(() => {
    const result = new Map()
    candidates.forEach((candidate) => {
      result.set(candidate.id, solveLayout(candidate, orderedAssets, project.style))
    })
    return result
  }, [candidates, orderedAssets, project.style])
  const selectedCandidate =
    candidates.find((candidate) => candidate.profile === project.layoutProfile) ??
    candidates[0]
  const solved = selectedCandidate
    ? solvedCandidates.get(selectedCandidate.id)
    : undefined
  const selectedAsset =
    project.assets.find((asset) => asset.id === selectedAssetId) ?? null
  const selectedPanel = selectedAssetId
    ? project.panels[selectedAssetId] ?? null
    : null
  const estimatedHeight = solved
    ? Math.round(
        (solved.height / solved.width) * project.exportSettings.width,
      )
    : 0

  useEffect(() => {
    let cancelled = false
    loadProject(projectId)
      .then((restored) => {
        if (cancelled) return
        if (!restored) {
          setNotice({ type: 'error', text: '工程不存在或已被删除。' })
          window.setTimeout(onProjects, 0)
          return
        }
        replace(restored)
        setSelectedAssetId(restored.panelOrder[0] ?? null)
        void setLastOpenProjectId(restored.id)
      })
      .catch((error: unknown) => {
        const reason = error instanceof Error
          ? error.message
          : '自动保存的工程无法读取。'
        setNotice({ type: 'error', text: `${reason} 已打开空白工程。` })
      })
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [onProjects, projectId, replace])

  useEffect(() => {
    if (!hydrated) return
    setSaveStatus('正在保存…')
    const timer = window.setTimeout(() => {
      saveProject(project)
        .then(() => setSaveStatus('已自动保存'))
        .catch(() => setSaveStatus('自动保存失败'))
    }, 800)
    return () => window.clearTimeout(timer)
  }, [hydrated, project])

  useEffect(() => {
    if (!hydrated) return
    const snapshot = project
    const timer = window.setTimeout(() => {
      createProjectThumbnail(snapshot)
        .then((thumbnail) => saveProjectThumbnail(
          snapshot.id,
          snapshot.updatedAt,
          thumbnail,
        ))
        .catch(() => undefined)
    }, 2_000)
    return () => window.clearTimeout(timer)
  }, [hydrated, project])

  useEffect(() => {
    const saveBeforeLeaving = () => {
      void saveProject(latestProjectRef.current)
    }
    window.addEventListener('hashchange', saveBeforeLeaving)
    window.addEventListener('pagehide', saveBeforeLeaving)
    return () => {
      window.removeEventListener('hashchange', saveBeforeLeaving)
      window.removeEventListener('pagehide', saveBeforeLeaving)
      revokeProjectUrls(latestProjectRef.current)
    }
  }, [])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [redo, undo])

  const showErrors = (errors: string[]) => {
    if (errors.length === 0) return
    const suffix = errors.length > 1 ? `（另有 ${errors.length - 1} 个问题）` : ''
    setNotice({ type: 'error', text: `${errors[0]}${suffix}` })
  }

  const handleFiles = useCallback(
    async (files: File[]) => {
      setBusyAction('import')
      const result = await importImageFiles(files, project.assets)
      if (result.assets.length > 0) {
        commit((current) => {
          const panels = { ...current.panels }
          result.assets.forEach((asset) => {
            panels[asset.id] = defaultPanelState(asset.id)
          })
          return {
            ...current,
            assets: [...current.assets, ...result.assets],
            panelOrder: [
              ...current.panelOrder,
              ...result.assets.map((asset) => asset.id),
            ],
            panels,
            layoutProfile: 'classic',
          }
        })
        setSelectedAssetId(result.assets[0].id)
        setNotice({
          type: 'success',
          text: `已导入 ${result.assets.length} 张图片。`,
        })
      }
      showErrors(result.errors)
      setBusyAction(null)
    },
    [commit, project.assets],
  )

  const updatePanel = (patch: Partial<PanelState>) => {
    if (!selectedAssetId) return
    commit((current) => ({
      ...current,
      panels: {
        ...current.panels,
        [selectedAssetId]: {
          ...current.panels[selectedAssetId],
          ...patch,
        },
      },
    }))
  }

  const updateStyle = (patch: Partial<FigureStyle>) => {
    commit((current) => ({
      ...current,
      style: { ...current.style, ...patch },
    }))
  }

  const selectCandidate = (candidate: LayoutCandidate) => {
    commit((current) => ({
      ...current,
      layoutProfile: candidate.profile,
    }))
  }

  const reorderAssets = (
    draggedId: string,
    targetId: string,
    position: ReorderPosition = 'before',
  ) => {
    commit((current) => {
      const order = reorderPanelOrder(
        current.panelOrder,
        draggedId,
        targetId,
        position,
      )
      if (order === current.panelOrder) return current
      return { ...current, panelOrder: order }
    })
  }

  const moveAsset = (assetId: string, direction: -1 | 1) => {
    commit((current) => {
      const order = [...current.panelOrder]
      const index = order.indexOf(assetId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return current
      ;[order[index], order[nextIndex]] = [order[nextIndex], order[index]]
      return { ...current, panelOrder: order }
    })
  }

  const removeAsset = (assetId: string) => {
    commit((current) => {
      const panels = { ...current.panels }
      delete panels[assetId]
      return {
        ...current,
        assets: current.assets.filter((asset) => asset.id !== assetId),
        panelOrder: current.panelOrder.filter((id) => id !== assetId),
        panels,
      }
    })
    if (selectedAssetId === assetId) {
      setSelectedAssetId(project.panelOrder.find((id) => id !== assetId) ?? null)
    }
  }

  const replaceAsset = async (assetId: string, file: File) => {
    const previous = project.assets.find((asset) => asset.id === assetId)
    if (!previous) return
    setBusyAction('replace')
    try {
      const replacement = await replaceImageFile(file, previous, project.assets)
      commit((current) => ({
        ...current,
        assets: current.assets.map((asset) =>
          asset.id === assetId ? replacement : asset,
        ),
      }))
      setNotice({ type: 'success', text: '图片已替换，面板设置保持不变。' })
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : '替换图片失败。',
      })
    } finally {
      setBusyAction(null)
    }
  }

  const requireSolved = () => {
    if (!solved || project.assets.length < MIN_PANEL_COUNT) {
      setNotice({ type: 'error', text: '请至少导入 2 张图片后再导出。' })
      return null
    }
    return solved
  }

  const flushCurrentProject = async () => {
    const snapshot = latestProjectRef.current
    await saveProject(snapshot)
    try {
      const thumbnail = await createProjectThumbnail(snapshot)
      await saveProjectThumbnail(snapshot.id, snapshot.updatedAt, thumbnail)
    } catch {
      // A stale or unavailable thumbnail must never block navigation.
    }
  }

  const returnToProjects = async () => {
    await folderBackup.backupNow()
    await flushCurrentProject()
    onProjects()
  }

  const openBackupSettings = async () => {
    await folderBackup.backupNow()
    await flushCurrentProject()
    onSettings()
  }

  const exportPng = async () => {
    const layout = requireSolved()
    if (!layout) return
    setBusyAction('png')
    try {
      await folderBackup.backupNow()
      const blob = await createPngBlob(
        project,
        layout,
        project.exportSettings.width,
      )
      downloadBlob(blob, projectFileName(project, 'png'))
      setNotice({ type: 'success', text: '高清 PNG 已生成。' })
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'PNG 导出失败。',
      })
    } finally {
      setBusyAction(null)
    }
  }

  const exportTiff = async () => {
    const layout = requireSolved()
    if (!layout) return
    setBusyAction('tiff')
    try {
      await folderBackup.backupNow()
      downloadBlob(await createTiffBlob(project, layout, project.exportSettings.width), projectFileName(project, 'tif'))
      setNotice({ type: 'success', text: '高清 TIFF 已生成。' })
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'TIFF 导出失败。' })
    } finally {
      setBusyAction(null)
    }
  }

  const exportSvg = async () => {
    const layout = requireSolved()
    if (!layout) return
    setBusyAction('svg')
    try {
      await folderBackup.backupNow()
      downloadBlob(
        await createSvgBlob(project, layout),
        projectFileName(project, 'svg'),
      )
      setNotice({ type: 'success', text: '可编辑 SVG 已生成。' })
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'SVG 导出失败。',
      })
    } finally {
      setBusyAction(null)
    }
  }

  const saveProjectFile = async () => {
    setBusyAction('project')
    try {
      await folderBackup.backupNow()
      const bundle = await createFiggridBundle(project)
      downloadBlob(bundle, projectFileName(project, 'figgrid'))
      setNotice({ type: 'success', text: '工程文件已保存。' })
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : '工程文件保存失败。',
      })
    } finally {
      setBusyAction(null)
    }
  }

  const openProjectFile = async (file: File) => {
    setBusyAction('open-project')
    try {
      await folderBackup.backupNow()
      const restored = await readFiggridBundle(file)
      const imported = copyProjectAsNew(restored)
      await saveProject(imported)
      revokeProjectUrls(restored)
      await setLastOpenProjectId(imported.id)
      onOpenProject(imported.id)
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : '工程文件无法打开。',
      })
    } finally {
      setBusyAction(null)
      if (projectInputRef.current) projectInputRef.current.value = ''
    }
  }

  const newProject = async () => {
    await folderBackup.backupNow()
    await flushCurrentProject()
    const next = createEmptyProject()
    await saveProject(next)
    await setLastOpenProjectId(next.id)
    onOpenProject(next.id)
  }

  if (!hydrated) {
    return <div className="route-loading">正在加载工程…</div>
  }

  return (
    <div className="app-shell">
      <div className="mobile-blocker">
        <strong>请在电脑上使用论文图片排版助手</strong>
        <span>当前 MVP 针对 1024px 以上的桌面屏幕设计。</span>
      </div>

      <header className="topbar">
        <div className="brand-block">
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
          <div>
            <strong>论文图片排版助手</strong>
            <span>本地科研多面板排图</span>
          </div>
        </div>
        <input
          className="project-title-input"
          value={project.title}
          aria-label="工程名称"
          maxLength={80}
          onChange={(event) =>
            commit((current) => ({ ...current, title: event.target.value }))
          }
          onBlur={() => {
            const title = normalizeProjectTitle(project.title)
            if (title !== project.title) {
              commit((current) => ({ ...current, title }))
            }
          }}
        />
        <div className="topbar-actions">
          <button type="button" onClick={() => void returnToProjects()}>
            我的工程
          </button>
          <span className="save-status"><i />{saveStatus}</span>
          <button type="button" onClick={undo} disabled={!canUndo} title="撤销">
            ↶ <span>撤销</span>
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} title="重做">
            ↷ <span>重做</span>
          </button>
          <button type="button" onClick={newProject}>新建</button>
          <button type="button" onClick={() => projectInputRef.current?.click()}>
            打开工程
          </button>
          <button
            type="button"
            className="toolbar-primary"
            onClick={saveProjectFile}
            disabled={busyAction !== null}
          >
            {busyAction === 'project' ? '正在保存…' : '保存工程'}
          </button>
          <input
            ref={projectInputRef}
            type="file"
            accept=".figgrid,application/x-figgrid"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void openProjectFile(file)
            }}
          />
        </div>
      </header>

      {notice && (
        <div className={`notice notice-${notice.type}`} role="status">
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">×</button>
        </div>
      )}

      <main className="workspace">
        <ImageSidebar
          assets={orderedAssets}
          selectedAssetId={selectedAssetId}
          onFiles={(files) => void handleFiles(files)}
          onSelect={setSelectedAssetId}
          onRemove={removeAsset}
          onReplace={(id, file) => void replaceAsset(id, file)}
          onReorder={reorderAssets}
          onMove={moveAsset}
          sectionOpen={editorSections.assets}
          onToggleSection={toggleSection}
        />

        <div className="canvas-column">
          {orderedAssets.length < MIN_PANEL_COUNT ? (
            <div className="welcome-state">
              <div className="welcome-visual" aria-hidden="true">
                <span /><span /><span /><span /><span /><span />
              </div>
              <span className="eyebrow">从原图开始</span>
              <h1>把科研图片，排得准确又整齐</h1>
              <p>
                {orderedAssets.length === 0
                  ? '拖入 2–12 张 PNG、JPG 或 WebP，我们会生成三种不裁图的布局方案。'
                  : '已添加 1 张图片，再添加至少 1 张即可生成布局。'}
              </p>
              <div className="welcome-points">
                <span>✓ 本地处理</span>
                <span>✓ 保留原图比例</span>
                <span>✓ 高清导出</span>
              </div>
            </div>
          ) : (
            <>
              <CandidatePicker
                project={project}
                candidates={candidates}
                solvedCandidates={solvedCandidates}
                onSelect={selectCandidate}
                sectionOpen={editorSections.layouts}
                onToggleSection={toggleSection}
              />
              {solved && (
                <CollapsibleSection
                  sectionId="preview"
                  title={selectedCandidate?.name ?? 'Figure 预览'}
                  eyebrow="Figure 预览"
                  summary="点击选择，拖动排序"
                  open={editorSections.preview}
                  className="figure-stage"
                  onToggle={toggleSection}
                >
                  <div
                    className={`canvas-frame${
                      project.style.background === 'transparent'
                        ? ' checkerboard'
                        : ''
                    }`}
                  >
                    <FigureCanvas
                      project={project}
                      solved={solved}
                      selectedAssetId={selectedAssetId}
                      interactive
                      onSelect={setSelectedAssetId}
                      onReorder={reorderAssets}
                    />
                  </div>
                  <div className="canvas-footer">
                    <span>{orderedAssets.length} 个面板</span>
                    <span>画布比例 {(solved.width / solved.height).toFixed(2)} : 1</span>
                    <span>SVG 画布 {Math.round(solved.width)} × {Math.round(solved.height)}</span>
                  </div>
                </CollapsibleSection>
              )}
            </>
          )}
        </div>

        <InspectorPanel
          stylePresets={<StylePresets project={project} onApply={(preset) => commit((current) => applyStylePreset(current, preset))} />}
          selectedAsset={selectedAsset}
          selectedPanel={selectedPanel}
          style={project.style}
          exportSettings={project.exportSettings}
          estimatedHeight={estimatedHeight}
          canExport={Boolean(solved && project.assets.length >= MIN_PANEL_COUNT)}
          busyAction={busyAction}
          onPanelChange={updatePanel}
          onStyleChange={updateStyle}
          onExportChange={(patch) =>
            commit((current) => ({
              ...current,
              exportSettings: { ...current.exportSettings, ...patch },
            }))
          }
          onExportPng={() => void exportPng()}
          onExportSvg={() => void exportSvg()}
          onExportTiff={() => void exportTiff()}
          folderBackup={folderBackup}
          onOpenBackupSettings={() => void openBackupSettings()}
          sectionState={editorSections}
          onToggleSection={toggleSection}
        />
      </main>
    </div>
  )
}

type AppRoute =
  | { page: 'landing' }
  | { page: 'projects' }
  | { page: 'settings' }
  | {
      page: 'bridge-import'
      params: BridgeImportParams | null
      error: string | null
    }
  | { page: 'editor'; projectId: string | null }

function routeFromHash(): AppRoute {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (hash === 'projects') return { page: 'projects' }
  if (hash === 'settings') return { page: 'settings' }
  if (hash.startsWith('bridge-import')) {
    try {
      return {
        page: 'bridge-import',
        params: parseBridgeImportHash(window.location.hash),
        error: null,
      }
    } catch (error) {
      return {
        page: 'bridge-import',
        params: null,
        error: error instanceof Error ? error.message : 'Origin 导入链接无效。',
      }
    }
  }
  if (hash === 'editor') return { page: 'editor', projectId: null }
  if (hash.startsWith('editor/')) {
    return { page: 'editor', projectId: hash.slice('editor/'.length) || null }
  }
  return { page: 'landing' }
}

function AppContent() {
  const [route, setRoute] = useState<AppRoute>(routeFromHash)

  const navigate = useCallback((target: string) => {
    if (target === 'landing') {
      window.history.pushState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`,
      )
      setRoute({ page: 'landing' })
      return
    }
    window.location.hash = target
    setRoute(routeFromHash())
  }, [])

  const openProjects = useCallback(() => navigate('projects'), [navigate])
  const openSettings = useCallback(() => navigate('settings'), [navigate])
  const openProject = useCallback(
    (projectId: string) => navigate(`editor/${projectId}`),
    [navigate],
  )

  useEffect(() => {
    const syncPage = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', syncPage)
    return () => window.removeEventListener('hashchange', syncPage)
  }, [])

  useEffect(() => {
    if (route.page !== 'editor' || route.projectId) return
    let cancelled = false
    getLastOpenProjectId()
      .then((projectId) => {
        if (cancelled) return
        if (projectId) openProject(projectId)
        else openProjects()
      })
      .catch(() => {
        if (!cancelled) openProjects()
      })
    return () => {
      cancelled = true
    }
  }, [openProject, openProjects, route])

  useEffect(() => {
    const isLanding = route.page === 'landing'
    const isDashboard = route.page === 'projects' || route.page === 'settings' ||
      route.page === 'bridge-import'
    document.documentElement.classList.toggle('landing-active', isLanding)
    document.body.classList.toggle('landing-active', isLanding)
    document.documentElement.classList.toggle('dashboard-active', isDashboard)
    document.body.classList.toggle('dashboard-active', isDashboard)
    document.title = route.page === 'landing'
      ? '论文图片排版助手 - 本地科研多面板排图'
      : route.page === 'projects'
        ? '我的工程 - 论文图片排版助手'
      : route.page === 'settings'
          ? '通用设置 - 论文图片排版助手'
          : route.page === 'bridge-import'
            ? '正在导入 Origin 工程 - 论文图片排版助手'
          : '论文图片排版助手 - 排图工作台'
    if (isLanding || isDashboard) {
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
    return () => {
      document.documentElement.classList.remove('landing-active')
      document.body.classList.remove('landing-active')
      document.documentElement.classList.remove('dashboard-active')
      document.body.classList.remove('dashboard-active')
    }
  }, [route.page])

  if (route.page === 'landing') {
    return <LandingPage onStart={openProjects} />
  }

  if (route.page === 'projects' || route.page === 'settings') {
    return (
      <DashboardShell
        active={route.page}
        onNavigate={(page) => navigate(page)}
      >
        {route.page === 'projects' ? (
          <ProjectsPage
            onOpenProject={openProject}
            onOpenSettings={openSettings}
          />
        ) : (
          <GeneralSettingsPage />
        )}
      </DashboardShell>
    )
  }

  if (route.page === 'bridge-import') {
    return (
      <BridgeImportPage
        params={route.params}
        initialError={route.error}
        onOpenProject={openProject}
        onProjects={openProjects}
      />
    )
  }

  if (!route.projectId) {
    return <div className="route-loading">正在打开上次工程…</div>
  }

  return (
    <EditorApp
      key={route.projectId}
      projectId={route.projectId}
      onProjects={openProjects}
      onSettings={openSettings}
      onOpenProject={openProject}
    />
  )
}

export default function App() {
  useAutomaticWorkspaceBackup()
  const sync = useWorkspaceBackupStatus()
  return <>
    {(sync.state === 'error' || sync.state === 'permission') && <div className="workspace-backup-warning" role="alert"><span>{sync.message}</span><button type="button" onClick={() => { window.location.hash = 'settings' }}>查看备份设置</button></div>}
    <AppContent />
  </>
}
