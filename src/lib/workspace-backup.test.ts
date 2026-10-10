// @vitest-environment node
import 'fake-indexeddb/auto'
import { File as NodeFile } from 'node:buffer'
import { openDB } from 'idb'
import { beforeEach, expect, it, vi } from 'vitest'
import { backupWorkspace, restoreWorkspace, hasWorkspaceBackup, WORKSPACE_MANIFEST, getWorkspaceBackupState } from './workspace-backup'
import { clearBackupPreferences, deleteProject, listProjectSummaries, loadProject, saveBackupPreferences, saveProject } from './storage'
import { createEmptyProject, defaultPanelState } from './project'
import { addProjectFolder, assignProjectFolder, readProjectFolders, writeProjectFolders } from './project-folders'
import { captureStylePreset, readStylePresets, writeStylePresets } from './style-presets'
import { PROJECT_SORT_KEY } from './project-sort'
import { createFiggridBundle } from './project-file'

class MemoryDirectory {
  readonly kind = 'directory'
  files = new Map<string, Blob>()
  directories = new Map<string, MemoryDirectory>()
  writes = new Map<string, number>()
  permission: PermissionState = 'granted'
  constructor(readonly name: string) {}
  async queryPermission() { return this.permission }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!options?.create && !this.files.has(name)) throw new DOMException('Missing', 'NotFoundError')
    return {
      kind: 'file', name,
      getFile: async () => new NodeFile([new Uint8Array(await this.files.get(name)!.arrayBuffer())], name),
      createWritable: async () => {
        let pending: Blob
        return { write: async (data: Blob) => { pending = data }, close: async () => { this.files.set(name, pending); this.writes.set(name, (this.writes.get(name) || 0) + 1) }, abort: async () => undefined }
      },
    } as unknown as FileSystemFileHandle
  }
  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle> {
    if (!this.directories.has(name) && options?.create) this.directories.set(name, new MemoryDirectory(name))
    if (!this.directories.has(name)) throw new DOMException('Missing', 'NotFoundError')
    return this.directories.get(name)!.handle()
  }
  async *entries() { for (const entry of this.directories) yield entry }
  handle() { return this as unknown as FileSystemDirectoryHandle }
}
const localValues = new Map<string, string>()
async function clearBrowserData() {
  const database = await openDB('layout-assistant', 3, { upgrade(db) {
    for (const store of ['projects', 'project-summaries', 'preferences']) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store)
  } })
  for (const store of ['projects', 'project-summaries', 'preferences']) await database.clear(store)
  database.close()
  await clearBackupPreferences()
  localValues.clear()
}
beforeEach(async () => {
  vi.stubGlobal('localStorage', { getItem: (key: string) => localValues.get(key) ?? null, setItem: (key: string, value: string) => localValues.set(key, value), removeItem: (key: string) => localValues.delete(key) })
  await clearBrowserData()
})
function fixture(title = '论文图') {
  const project = createEmptyProject()
  project.title = title
  project.updatedAt = '2026-10-09T10:00:00.000Z'
  const blob = new Blob(['original-image-bytes'], { type: 'image/png' })
  project.assets = [{ id: 'image', name: 'image.png', mime: 'image/png', width: 400, height: 300, blob, size: blob.size, previewUrl: 'blob:fixture' }]
  project.panelOrder = ['image']
  project.panels = { image: { ...defaultPanelState('image'), zoom: 0.75 } }
  project.style.labelOffsetX = -20
  return project
}
async function enable(root: MemoryDirectory) {
  await saveBackupPreferences({ enabled: true, rootHandle: root.handle(), projectFolders: {}, lastBackupAt: {}, lastHistoryAt: {} })
}
it('backs up all projects and metadata, updates changes and restores after clearing browser data without duplicates', async () => {
  const root = new MemoryDirectory('科研备份')
  const first = fixture()
  const second = fixture('第二张图')
  await saveProject(first)
  await saveProject(second)
  writeStylePresets([captureStylePreset(first, '论文格式')])
  const folders = addProjectFolder(readProjectFolders(), '论文')
  writeProjectFolders(assignProjectFolder(folders, first.id, folders.folders[0].id))
  localStorage.setItem(PROJECT_SORT_KEY, 'name')
  await enable(root)
  await backupWorkspace()
  expect(await hasWorkspaceBackup(root.handle())).toBe(true)
  const manifest = JSON.parse(await root.files.get(WORKSPACE_MANIFEST)!.text())
  expect(manifest.projects).toHaveLength(2)
  const directory = root.directories.get(manifest.projects.find((p: { id: string }) => p.id === first.id).folder)!
  const writes = directory.writes.get('latest.figgrid')
  await backupWorkspace()
  expect(directory.writes.get('latest.figgrid')).toBe(writes)
  first.updatedAt = '2026-10-09T11:00:00.000Z'
  first.style.labelOffsetX = -35
  await saveProject(first)
  await backupWorkspace()
  expect(directory.writes.get('latest.figgrid')).toBe(writes! + 1)
  await clearBrowserData()
  expect(await restoreWorkspace(root.handle())).toBe(2)
  expect(await listProjectSummaries()).toHaveLength(2)
  const restored = (await loadProject(first.id))!
  expect(restored.style.labelOffsetX).toBe(-35)
  expect(restored.panels.image.zoom).toBe(0.75)
  expect(await restored.assets[0].blob.text()).toBe('original-image-bytes')
  expect(readStylePresets()[0].name).toBe('论文格式')
  expect(readProjectFolders().assignments[first.id]).toBe(folders.folders[0].id)
  expect(localStorage.getItem(PROJECT_SORT_KEY)).toBe('name')
  expect(await restoreWorkspace(root.handle())).toBe(0)
  restored.updatedAt = '2026-10-10T00:00:00.000Z'
  restored.title = '较新的本地版本'
  await saveProject(restored)
  await restoreWorkspace(root.handle())
  expect((await loadProject(first.id))!.title).toBe('较新的本地版本')
})
it('validates every archive before importing and leaves existing data intact on a corrupt backup', async () => {
  const root = new MemoryDirectory('备份')
  await saveProject(fixture())
  await saveProject(fixture('第二张'))
  await enable(root)
  await backupWorkspace()
  const manifest = JSON.parse(await root.files.get(WORKSPACE_MANIFEST)!.text())
  root.directories.get(manifest.projects[1].folder)!.files.set('latest.figgrid', new Blob(['broken']))
  await clearBrowserData()
  await expect(restoreWorkspace(root.handle())).rejects.toThrow()
  expect(await listProjectSummaries()).toHaveLength(0)
  expect(readStylePresets()).toEqual([])
})
it('does not resurrect deleted projects from archived files or write without permission', async () => {
  const root = new MemoryDirectory('备份')
  const project = fixture()
  await saveProject(project)
  await enable(root)
  await backupWorkspace()
  await deleteProject(project.id)
  // Browser directory handles survive structured cloning; the in-memory fake does not.
  await enable(root)
  await backupWorkspace()
  const last = await root.files.get(WORKSPACE_MANIFEST)!.text()
  expect(JSON.parse(last).projects).toEqual([])
  root.permission = 'prompt'
  await backupWorkspace()
  expect(getWorkspaceBackupState().state).toBe('permission')
  expect(await root.files.get(WORKSPACE_MANIFEST)!.text()).toBe(last)
  root.permission = 'granted'
  await clearBrowserData()
  expect(await restoreWorkspace(root.handle())).toBe(0)
  expect(await listProjectSummaries()).toHaveLength(0)
})
it('recovers existing latest.figgrid directories without a workspace manifest', async () => {
  const root = new MemoryDirectory('旧备份')
  const child = new MemoryDirectory('旧工程')
  const project = fixture()
  child.files.set('latest.figgrid', await createFiggridBundle(project))
  root.directories.set('旧工程', child)
  expect(await restoreWorkspace(root.handle())).toBe(1)
  expect((await loadProject(project.id))!.title).toBe('论文图')
})
