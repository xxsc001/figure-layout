import { notifyWorkspaceChanged } from './workspace-events'
import { openDB, type IDBPDatabase } from 'idb'
import type {
  BackupPreferences,
  FigureProjectV2,
  ProjectSummary,
  StoredFigureProjectV1,
  StoredFigureProjectV2,
} from '../types'
import {
  copyProjectAsNew,
  fromStoredProject,
  migrateStoredProject,
  normalizeProjectTitle,
  toStoredProject,
} from './project'

const DATABASE_NAME = 'layout-assistant'
const DATABASE_VERSION = 3
const PROJECT_STORE_NAME = 'projects'
const SUMMARY_STORE_NAME = 'project-summaries'
const PREFERENCE_STORE_NAME = 'preferences'
const LEGACY_ACTIVE_KEY = 'active-project'
const BACKUP_KEY = 'folder-backup'
const LAST_OPEN_PROJECT_KEY = 'last-open-project-id'

type StoredProject = StoredFigureProjectV1 | StoredFigureProjectV2
let currentSessionBackupPreferences: BackupPreferences | null = null

export const DEFAULT_BACKUP_PREFERENCES: BackupPreferences = {
  enabled: false,
  rootHandle: null,
  projectFolders: {},
  lastBackupAt: {},
  lastHistoryAt: {},
}

async function openDatabase() {
  return openDB(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(PROJECT_STORE_NAME)) {
        database.createObjectStore(PROJECT_STORE_NAME)
      }
      if (!database.objectStoreNames.contains(SUMMARY_STORE_NAME)) {
        database.createObjectStore(SUMMARY_STORE_NAME)
      }
      if (!database.objectStoreNames.contains(PREFERENCE_STORE_NAME)) {
        database.createObjectStore(PREFERENCE_STORE_NAME)
      }
    },
  })
}

function summaryFromProject(
  project: StoredFigureProjectV2,
  previous?: ProjectSummary,
): ProjectSummary {
  return {
    id: project.id,
    title: normalizeProjectTitle(project.title),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    panelCount: project.panelOrder.length,
    thumbnail: previous?.thumbnail ?? null,
    thumbnailUpdatedAt: previous?.thumbnailUpdatedAt ?? null,
  }
}

async function migrateLegacyActiveProject(database: IDBPDatabase) {
  const transaction = database.transaction(
    [PROJECT_STORE_NAME, SUMMARY_STORE_NAME, PREFERENCE_STORE_NAME],
    'readwrite',
  )
  const projects = transaction.objectStore(PROJECT_STORE_NAME)
  const legacy = await projects.get(LEGACY_ACTIVE_KEY) as StoredProject | undefined
  if (!legacy) {
    await transaction.done
    return
  }

  const migrated = migrateStoredProject(legacy)
  const existing = await projects.get(migrated.id) as StoredProject | undefined
  if (!existing) {
    await projects.put(migrated, migrated.id)
    await transaction.objectStore(SUMMARY_STORE_NAME).put(
      summaryFromProject(migrated),
      migrated.id,
    )
  }
  await projects.delete(LEGACY_ACTIVE_KEY)
  const preferences = transaction.objectStore(PREFERENCE_STORE_NAME)
  const lastOpen = await preferences.get(LAST_OPEN_PROJECT_KEY)
  if (!lastOpen) await preferences.put(migrated.id, LAST_OPEN_PROJECT_KEY)
  await transaction.done
}

async function getProjectDatabase() {
  const database = await openDatabase()
  await migrateLegacyActiveProject(database)
  return database
}

export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const database = await getProjectDatabase()
  const summaries = await database.getAll(SUMMARY_STORE_NAME) as ProjectSummary[]
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function loadProject(
  projectId: string,
): Promise<FigureProjectV2 | null> {
  const database = await getProjectDatabase()
  const stored = await database.get(
    PROJECT_STORE_NAME,
    projectId,
  ) as StoredProject | undefined
  if (!stored) return null
  const migrated = migrateStoredProject(stored)
  if (stored.schemaVersion !== migrated.schemaVersion) {
    await database.put(PROJECT_STORE_NAME, migrated, projectId)
  }
  return fromStoredProject(migrated)
}

export async function saveProject(project: FigureProjectV2) {
  const database = await getProjectDatabase()
  const transaction = database.transaction(
    [PROJECT_STORE_NAME, SUMMARY_STORE_NAME],
    'readwrite',
  )
  const summaries = transaction.objectStore(SUMMARY_STORE_NAME)
  const previous = await summaries.get(project.id) as ProjectSummary | undefined
  const stored = toStoredProject(project)
  await transaction.objectStore(PROJECT_STORE_NAME).put(stored, project.id)
  await summaries.put(summaryFromProject(stored, previous), project.id)
  await transaction.done
  notifyWorkspaceChanged()
}

export async function saveProjectThumbnail(
  projectId: string,
  expectedUpdatedAt: string,
  thumbnail: Blob | null,
) {
  const database = await getProjectDatabase()
  const transaction = database.transaction(
    [PROJECT_STORE_NAME, SUMMARY_STORE_NAME],
    'readwrite',
  )
  const stored = await transaction.objectStore(PROJECT_STORE_NAME).get(
    projectId,
  ) as StoredProject | undefined
  const summary = await transaction.objectStore(SUMMARY_STORE_NAME).get(
    projectId,
  ) as ProjectSummary | undefined
  if (!stored || !summary || stored.updatedAt !== expectedUpdatedAt) {
    await transaction.done
    return false
  }
  await transaction.objectStore(SUMMARY_STORE_NAME).put({
    ...summary,
    thumbnail,
    thumbnailUpdatedAt: expectedUpdatedAt,
  }, projectId)
  await transaction.done
  return true
}

export async function renameProject(projectId: string, title: string) {
  const project = await loadProject(projectId)
  if (!project) throw new Error('工程不存在或已被删除。')
  try {
    project.title = normalizeProjectTitle(title)
    project.updatedAt = new Date().toISOString()
    await saveProject(project)
    return project
  } catch (error) {
    project.assets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl))
    throw error
  }
}

export async function duplicateProject(projectId: string) {
  const project = await loadProject(projectId)
  if (!project) throw new Error('工程不存在或已被删除。')
  try {
    const sourceTitle = normalizeProjectTitle(project.title)
    const duplicate = copyProjectAsNew(
      project,
      `${sourceTitle.slice(0, 77)} 副本`,
    )
    await saveProject(duplicate)

    const database = await getProjectDatabase()
    const sourceSummary = await database.get(
      SUMMARY_STORE_NAME,
      projectId,
    ) as ProjectSummary | undefined
    if (sourceSummary?.thumbnail) {
      await saveProjectThumbnail(
        duplicate.id,
        duplicate.updatedAt,
        sourceSummary.thumbnail,
      )
    }
    return duplicate
  } catch (error) {
    project.assets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl))
    throw error
  }
}

export async function deleteProject(projectId: string) {
  return deleteProjects([projectId])
}

export async function deleteProjects(projectIds: string[]) {
  const database = await getProjectDatabase()
  const transaction = database.transaction(
    [PROJECT_STORE_NAME, SUMMARY_STORE_NAME, PREFERENCE_STORE_NAME],
    'readwrite',
  )
  for (const projectId of projectIds) {
    await transaction.objectStore(PROJECT_STORE_NAME).delete(projectId)
    await transaction.objectStore(SUMMARY_STORE_NAME).delete(projectId)
  }

  const preferences = transaction.objectStore(PREFERENCE_STORE_NAME)
  const backup = await preferences.get(BACKUP_KEY) as BackupPreferences | undefined
  if (backup) {
    const projectFolders = { ...backup.projectFolders }
    const lastBackupAt = { ...backup.lastBackupAt }
    const lastHistoryAt = { ...backup.lastHistoryAt }
    for (const projectId of projectIds) {
      delete projectFolders[projectId]
      delete lastBackupAt[projectId]
      delete lastHistoryAt[projectId]
    }
    const nextBackup = {
      ...backup,
      projectFolders,
      lastBackupAt,
      lastHistoryAt,
    }
    await preferences.put(nextBackup, BACKUP_KEY)
    currentSessionBackupPreferences = nextBackup
  }
  if (projectIds.includes(await preferences.get(LAST_OPEN_PROJECT_KEY))) {
    await preferences.delete(LAST_OPEN_PROJECT_KEY)
  }
  await transaction.done
  notifyWorkspaceChanged()
}

export async function setLastOpenProjectId(projectId: string | null) {
  const database = await openDatabase()
  if (projectId) {
    await database.put(PREFERENCE_STORE_NAME, projectId, LAST_OPEN_PROJECT_KEY)
  } else {
    await database.delete(PREFERENCE_STORE_NAME, LAST_OPEN_PROJECT_KEY)
  }
}

export async function getLastOpenProjectId(): Promise<string | null> {
  const database = await getProjectDatabase()
  const projectId = await database.get(
    PREFERENCE_STORE_NAME,
    LAST_OPEN_PROJECT_KEY,
  ) as string | undefined
  return projectId ?? null
}

export async function saveBackupPreferences(preferences: BackupPreferences) {
  const notify = currentSessionBackupPreferences?.enabled !== preferences.enabled || currentSessionBackupPreferences?.rootHandle !== preferences.rootHandle
  const database = await openDatabase()
  await database.put(PREFERENCE_STORE_NAME, preferences, BACKUP_KEY)
  currentSessionBackupPreferences = preferences
  if (notify) notifyWorkspaceChanged()
}

export async function loadBackupPreferences(): Promise<BackupPreferences> {
  if (currentSessionBackupPreferences) return currentSessionBackupPreferences
  const database = await openDatabase()
  const stored = await database.get(
    PREFERENCE_STORE_NAME,
    BACKUP_KEY,
  ) as Partial<BackupPreferences> | undefined
  const preferences = {
    ...DEFAULT_BACKUP_PREFERENCES,
    ...stored,
    projectFolders: { ...stored?.projectFolders },
    lastBackupAt: { ...stored?.lastBackupAt },
    lastHistoryAt: { ...stored?.lastHistoryAt },
  }
  currentSessionBackupPreferences = preferences
  return preferences
}

export async function clearBackupPreferences() {
  const database = await openDatabase()
  await database.delete(PREFERENCE_STORE_NAME, BACKUP_KEY)
  currentSessionBackupPreferences = null
}

// Compatibility helpers for older callers while the UI migrates to project IDs.
export async function saveActiveProject(project: FigureProjectV2) {
  await saveProject(project)
  await setLastOpenProjectId(project.id)
}

export async function loadActiveProject() {
  const projectId = await getLastOpenProjectId()
  return projectId ? loadProject(projectId) : null
}

export async function clearActiveProject() {
  await setLastOpenProjectId(null)
}

export async function restoreProjects(projects: FigureProjectV2[]) {
  const database = await getProjectDatabase()
  const transaction = database.transaction([PROJECT_STORE_NAME, SUMMARY_STORE_NAME], 'readwrite')
  let count = 0
  try {
    for (const project of projects) {
      const existing = await transaction.objectStore(PROJECT_STORE_NAME).get(project.id) as StoredProject | undefined
      if (existing && existing.updatedAt >= project.updatedAt) continue
      const previous = await transaction.objectStore(SUMMARY_STORE_NAME).get(project.id) as ProjectSummary | undefined
      const stored = toStoredProject(project)
      await transaction.objectStore(PROJECT_STORE_NAME).put(stored, project.id)
      await transaction.objectStore(SUMMARY_STORE_NAME).put(summaryFromProject(stored, previous), project.id)
      count++
    }
    await transaction.done
    return count
  } catch (error) {
    try { transaction.abort() } catch { /* Transaction may have already aborted. */ }
    await transaction.done.catch(() => undefined)
    throw error
  }
}
