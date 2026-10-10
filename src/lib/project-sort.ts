import type { ProjectSummary } from '../types'
import type { ProjectFolders } from './project-folders'
export type ProjectSort = 'updated' | 'name'
export const PROJECT_SORT_KEY = 'layout-assistant:project-sort:v1'
const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })
export function sortProjects(projects: ProjectSummary[], mode: ProjectSort) {
  return [...projects].sort((a, b) => mode === 'name' ? collator.compare(a.title, b.title) : b.updatedAt.localeCompare(a.updatedAt) || collator.compare(a.title, b.title))
}
export function sortFolders(data: ProjectFolders, projects: ProjectSummary[], mode: ProjectSort) {
  const latest = new Map(data.folders.map((folder) => [folder.id, folder.createdAt || '']))
  for (const project of projects) {
    const folderId = data.assignments[project.id]
    if (folderId && project.updatedAt > (latest.get(folderId) || '')) latest.set(folderId, project.updatedAt)
  }
  return [...data.folders].sort((a, b) => mode === 'name' ? collator.compare(a.name, b.name) : (latest.get(b.id) || '').localeCompare(latest.get(a.id) || '') || collator.compare(a.name, b.name))
}
