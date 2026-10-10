import type { FigureProjectV2 } from '../types'
import { createFiggridBundleInWorker } from './figgrid-worker'
import { readFiggridBundle } from './project-file'
import { createProjectBackupFolderName, queryBackupPermission, writeBackupBundle, writeBlob } from './folder-backup'
import { listProjectSummaries, loadProject, loadBackupPreferences, saveBackupPreferences, restoreProjects } from './storage'
import { STYLE_PRESETS_KEY, readStylePresets } from './style-presets'
import { PROJECT_FOLDERS_KEY, readProjectFolders } from './project-folders'
import { PROJECT_SORT_KEY } from './project-sort'

export const WORKSPACE_MANIFEST = 'layout-assistant-backup.json'
const PREVIOUS_MANIFEST = 'layout-assistant-backup.previous.json'
const METADATA_KEYS = [STYLE_PRESETS_KEY, PROJECT_FOLDERS_KEY, PROJECT_SORT_KEY] as const
export interface WorkspaceManifest {
  version: 1
  savedAt: string
  projects: Array<{ id: string; folder: string; updatedAt: string }>
  metadata: Record<string, string>
}
export interface WorkspaceBackupState {
  state: 'idle' | 'scheduled' | 'writing' | 'restoring' | 'success' | 'permission' | 'error'
  message: string
}
let state: WorkspaceBackupState = { state: 'idle', message: '' }
const subscribers = new Set<() => void>()
export function subscribeWorkspaceBackup(listener: () => void) { subscribers.add(listener); return () => { subscribers.delete(listener) } }
export function getWorkspaceBackupState() { return state }
function setState(next: WorkspaceBackupState) { state = next; subscribers.forEach((listener) => listener()) }
let restoring = false
let serial: Promise<unknown> = Promise.resolve()
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const next = serial.catch(() => undefined).then(task)
  serial = next
  return next
}
function notFound(error: unknown) { return error instanceof DOMException && error.name === 'NotFoundError' }
function segment(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && !/[\\/]/.test(value) && value !== '.' && value !== '..' }

export function validateWorkspaceManifest(value: unknown): asserts value is WorkspaceManifest {
  if (!value || typeof value !== 'object') throw new Error('备份清单无效。')
  const manifest = value as WorkspaceManifest
  if (manifest.version !== 1 || typeof manifest.savedAt !== 'string' || !Array.isArray(manifest.projects) || !manifest.metadata || typeof manifest.metadata !== 'object') throw new Error('备份清单版本或内容无效。')
  if (manifest.projects.some((project) => !project || typeof project.id !== 'string' || !project.id || !segment(project.folder) || typeof project.updatedAt !== 'string') || new Set(manifest.projects.map((project) => project.id)).size !== manifest.projects.length) throw new Error('备份工程目录无效。')
  for (const key of METADATA_KEYS) {
    const raw = manifest.metadata[key]
    if (typeof raw !== 'string') throw new Error('备份缺少管理信息。')
    if (key === PROJECT_SORT_KEY) { if (!['updated', 'name'].includes(raw)) throw new Error('排序备份无效。'); continue }
    const parsed: unknown = JSON.parse(raw)
    if (key === STYLE_PRESETS_KEY && (!Array.isArray(parsed) || parsed.some((preset) => !preset || typeof preset.id !== 'string' || typeof preset.name !== 'string' || !preset.style || !preset.exportSettings || !Array.isArray(preset.panels)))) throw new Error('常用样式备份无效。')
    if (key === PROJECT_FOLDERS_KEY) {
      const data = parsed as { folders?: Array<{ id: string; name: string }>; assignments?: Record<string, string> } | null
      if (!data || !Array.isArray(data.folders) || data.folders.some((folder) => !folder || typeof folder.id !== 'string' || typeof folder.name !== 'string') || !data.assignments || typeof data.assignments !== 'object' || Object.values(data.assignments).some((id) => typeof id !== 'string')) throw new Error('工程文件夹备份无效。')
    }
  }
}
async function readManifest(root: FileSystemDirectoryHandle, name = WORKSPACE_MANIFEST): Promise<WorkspaceManifest | null> {
  let file: File
  try { file = await (await root.getFileHandle(name)).getFile() }
  catch (error) { if (notFound(error)) return null; throw error }
  const parsed: unknown = JSON.parse(await file.text())
  validateWorkspaceManifest(parsed)
  return parsed
}
export async function hasWorkspaceBackup(root: FileSystemDirectoryHandle) {
  for (const name of [WORKSPACE_MANIFEST, PREVIOUS_MANIFEST]) {
    try { await root.getFileHandle(name); return true } catch (error) { if (!notFound(error)) throw error }
  }
  for await (const [, handle] of root.entries()) {
    if (handle.kind !== 'directory') continue
    try { await (handle as FileSystemDirectoryHandle).getFileHandle('latest.figgrid'); return true }
    catch (error) { if (!notFound(error)) throw error }
  }
  return false
}
function metadataSnapshot() {
  // Validate local state before replacing a known good disk backup.
  readStylePresets()
  readProjectFolders()
  return {
    [STYLE_PRESETS_KEY]: localStorage.getItem(STYLE_PRESETS_KEY) || '[]',
    [PROJECT_FOLDERS_KEY]: localStorage.getItem(PROJECT_FOLDERS_KEY) || '{"folders":[],"assignments":{}}',
    [PROJECT_SORT_KEY]: localStorage.getItem(PROJECT_SORT_KEY) === 'name' ? 'name' : 'updated',
  }
}

export function backupWorkspace(): Promise<void> {
  if (restoring) return Promise.resolve()
  return exclusive(async () => {
    if (restoring) return
    const preferences = await loadBackupPreferences()
    if (!preferences.enabled || !preferences.rootHandle) return
    const root = preferences.rootHandle
    if (await queryBackupPermission(root) !== 'granted') { setState({ state: 'permission', message: '备份目录需要重新授权。' }); return }
    setState({ state: 'writing', message: '正在更新完整备份…' })
    const previous = await readManifest(root)
    const metadata = metadataSnapshot()
    const summaries = await listProjectSummaries()
    const projects: WorkspaceManifest['projects'] = []
    const mappings: Record<string, string> = {}
    const times: Record<string, string> = {}
    for (const summary of summaries) {
      const old = previous?.projects.find((project) => project.id === summary.id)
      const folder = old?.folder || preferences.projectFolders[summary.id] || createProjectBackupFolderName(summary)
      mappings[summary.id] = folder
      let exists = false
      if (old?.updatedAt === summary.updatedAt) {
        try { await (await root.getDirectoryHandle(folder)).getFileHandle('latest.figgrid'); exists = true }
        catch (error) { if (!notFound(error)) throw error }
      }
      if (!exists) {
        const project = await loadProject(summary.id)
        if (!project) continue
        try {
          const bundle = await createFiggridBundleInWorker(project)
          await writeBackupBundle({ rootHandle: root, projectFolderName: folder, bundle, createHistory: false })
          times[project.id] = new Date().toISOString()
          projects.push({ id: project.id, folder, updatedAt: project.updatedAt })
        } finally { project.assets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl)) }
      } else projects.push({ id: summary.id, folder, updatedAt: summary.updatedAt })
    }
    const manifest: WorkspaceManifest = { version: 1, savedAt: new Date().toISOString(), projects, metadata }
    validateWorkspaceManifest(manifest)
    if (previous) await writeBlob(root, PREVIOUS_MANIFEST, new Blob([JSON.stringify(previous)], { type: 'application/json' }))
    await writeBlob(root, WORKSPACE_MANIFEST, new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }))
    const latest = await loadBackupPreferences()
    await saveBackupPreferences({ ...latest, projectFolders: { ...latest.projectFolders, ...mappings }, lastBackupAt: { ...latest.lastBackupAt, ...times } })
    setState({ state: 'success', message: '工程、常用样式和文件夹分类已自动备份。' })
  }).catch((error) => {
    setState({ state: 'error', message: error instanceof Error ? error.message : '完整备份失败。' })
    throw error
  })
}

function mergeMetadata(disk: Record<string, string>) {
  const localPresets = readStylePresets()
  const backupPresets = JSON.parse(disk[STYLE_PRESETS_KEY]) as typeof localPresets
  const presets = new Map(backupPresets.map((preset) => [preset.id, preset]))
  localPresets.forEach((preset) => presets.set(preset.id, preset))
  const localFolders = readProjectFolders()
  const backupFolders = JSON.parse(disk[PROJECT_FOLDERS_KEY]) as typeof localFolders
  const folders = new Map(backupFolders.folders.map((folder) => [folder.id, folder]))
  localFolders.folders.forEach((folder) => folders.set(folder.id, folder))
  return {
    [STYLE_PRESETS_KEY]: JSON.stringify([...presets.values()]),
    [PROJECT_FOLDERS_KEY]: JSON.stringify({ folders: [...folders.values()], assignments: { ...backupFolders.assignments, ...localFolders.assignments } }),
    [PROJECT_SORT_KEY]: disk[PROJECT_SORT_KEY],
  }
}

export async function restoreWorkspace(root: FileSystemDirectoryHandle) {
  restoring = true
  return exclusive(async () => {
    setState({ state: 'restoring', message: '正在读取和恢复备份…' })
    if (await queryBackupPermission(root) !== 'granted') throw new Error('请允许读取和写入备份文件夹。')
    let manifest: WorkspaceManifest | null
    let usedPrevious = false
    try { manifest = await readManifest(root) }
    catch (error) { manifest = await readManifest(root, PREVIOUS_MANIFEST); if (!manifest) throw error; usedPrevious = true }
    if (!manifest) {
      manifest = await readManifest(root, PREVIOUS_MANIFEST)
      usedPrevious = !!manifest
    }
    const restored: FigureProjectV2[] = []
    const projectFolders: Record<string, string> = {}
    try {
      let entries = manifest?.projects
      if (!entries) {
        entries = []
        for await (const [name, handle] of root.entries()) {
          if (handle.kind !== 'directory') continue
          try { await (handle as FileSystemDirectoryHandle).getFileHandle('latest.figgrid'); entries.push({ id: '', folder: name, updatedAt: '' }) }
          catch (error) { if (!notFound(error)) throw error }
        }
        if (!entries.length) throw new Error('这个目录中没有找到可恢复的备份。请选择原来设置的备份根目录。')
      }
      for (const entry of entries) {
        const directory = await root.getDirectoryHandle(entry.folder)
        const file = await (await directory.getFileHandle('latest.figgrid')).getFile()
        const project = await readFiggridBundle(file)
        if (entry.id && project.id !== entry.id) {
          project.assets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl))
          throw new Error('备份工程与清单不匹配，未执行恢复。')
        }
        restored.push(project)
        projectFolders[project.id] = entry.folder
      }
      // Parse every bundle before changing browser data. Keep newer local projects.
      const metadata = manifest ? mergeMetadata(manifest.metadata) : metadataSnapshot()
      const previousValues = METADATA_KEYS.map((key) => [key, localStorage.getItem(key)] as const)
      try {
        for (const key of METADATA_KEYS) localStorage.setItem(key, metadata[key])
        const count = await restoreProjects(restored)
        const current = await loadBackupPreferences()
        await saveBackupPreferences({ ...current, enabled: true, rootHandle: root, projectFolders: { ...current.projectFolders, ...projectFolders } })
        setState({ state: 'success', message: `已恢复 ${count} 个工程及管理设置${usedPrevious ? '（使用上一份清单）' : ''}，自动备份已开启。` })
        return count
      } catch (error) {
        for (const [key, value] of previousValues) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* Preserve the original failure. */ } }
        throw error
      }
    } finally { restored.forEach((project) => project.assets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl))) }
  }).catch((error) => {
    setState({ state: 'error', message: error instanceof Error ? error.message : '恢复失败。' })
    throw error
  }).finally(() => { restoring = false })
}

export function markWorkspaceBackupScheduled() {
  if (!restoring && state.state !== 'writing') setState({ state: 'scheduled', message: '正在等待自动备份…' })
}
