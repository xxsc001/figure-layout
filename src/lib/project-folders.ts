import { notifyWorkspaceChanged } from './workspace-events'
import { createId } from './browser-crypto'
export const PROJECT_FOLDERS_KEY = 'layout-assistant:project-folders:v1'
export interface ProjectFolders {
  folders: Array<{ id: string; name: string; createdAt?: string }>
  assignments: Record<string, string>
}
export function readProjectFolders(): ProjectFolders {
  const raw = localStorage.getItem(PROJECT_FOLDERS_KEY)
  if (!raw) return { folders: [], assignments: {} }
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('folders' in value) || !Array.isArray(value.folders) || !('assignments' in value) || !value.assignments || typeof value.assignments !== 'object' || value.folders.some((folder) => !folder || typeof folder.id !== 'string' || typeof folder.name !== 'string')) throw new Error('无法读取工程文件夹。')
  return value as ProjectFolders
}
export function writeProjectFolders(value: ProjectFolders) {
  localStorage.setItem(PROJECT_FOLDERS_KEY, JSON.stringify(value))
  notifyWorkspaceChanged()
}
export function addProjectFolder(value: ProjectFolders, name: string): ProjectFolders {
  const trimmed = name.trim().slice(0, 60)
  if (!trimmed) throw new Error('请输入文件夹名称。')
  if (value.folders.some((folder) => folder.name === trimmed)) throw new Error('已存在同名文件夹。')
  return { ...value, folders: [...value.folders, { id: createId(), name: trimmed, createdAt: new Date().toISOString() }] }
}
export function assignProjectFolder(value: ProjectFolders, projectId: string, folderId: string): ProjectFolders {
  if (folderId && !value.folders.some((folder) => folder.id === folderId)) throw new Error('文件夹不存在。')
  const assignments = { ...value.assignments }
  if (folderId) assignments[projectId] = folderId
  else delete assignments[projectId]
  return { ...value, assignments }
}
export function removeProjectFolder(value: ProjectFolders, folderId: string): ProjectFolders {
  return { folders: value.folders.filter((folder) => folder.id !== folderId), assignments: Object.fromEntries(Object.entries(value.assignments).filter(([, id]) => id !== folderId)) }
}
