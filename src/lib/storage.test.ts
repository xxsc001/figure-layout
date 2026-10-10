import '../test/setup'
import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it } from 'vitest'
import { openDB } from 'idb'
import { createEmptyProject, defaultPanelState } from './project'
import {
  clearBackupPreferences,
  deleteProject,
  duplicateProject,
  getLastOpenProjectId,
  listProjectSummaries,
  loadBackupPreferences,
  loadProject,
  renameProject,
  saveBackupPreferences,
  saveProject,
  saveProjectThumbnail,
  setLastOpenProjectId,
} from './storage'

async function resetDatabase() {
  const database = await openDB('layout-assistant', 3, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects')
      }
      if (!db.objectStoreNames.contains('project-summaries')) {
        db.createObjectStore('project-summaries')
      }
      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences')
      }
    },
  })
  const transaction = database.transaction(
    ['projects', 'project-summaries', 'preferences'],
    'readwrite',
  )
  await Promise.all([
    transaction.objectStore('projects').clear(),
    transaction.objectStore('project-summaries').clear(),
    transaction.objectStore('preferences').clear(),
  ])
  await transaction.done
  database.close()
  await clearBackupPreferences()
}

function projectWithAsset(title: string) {
  const project = createEmptyProject()
  project.title = title
  const blob = new NodeBlob(['image'], { type: 'image/png' }) as unknown as Blob
  const asset = {
    id: 'asset-1',
    name: 'panel.png',
    mime: 'image/png' as const,
    width: 400,
    height: 300,
    size: blob.size,
    blob,
    previewUrl: 'blob:fixture',
  }
  project.assets = [asset]
  project.panelOrder = [asset.id]
  project.panels = { [asset.id]: defaultPanelState(asset.id) }
  return project
}

describe('IndexedDB project library', () => {
  beforeEach(resetDatabase)

  it('saves full projects and lists lightweight summaries by update time', async () => {
    const older = projectWithAsset('较早工程')
    older.updatedAt = '2026-01-01T00:00:00.000Z'
    const newer = createEmptyProject()
    newer.title = '较新工程'
    newer.updatedAt = '2026-02-01T00:00:00.000Z'

    await saveProject(older)
    await saveProject(newer)
    const summaries = await listProjectSummaries()
    const restored = await loadProject(older.id)

    expect(summaries.map((summary) => summary.title)).toEqual([
      '较新工程',
      '较早工程',
    ])
    expect(summaries[1].panelCount).toBe(1)
    expect(summaries[1]).not.toHaveProperty('assets')
    expect(restored?.assets[0].blob.size).toBe(older.assets[0].blob.size)
    expect(restored?.assets[0].previewUrl).toMatch(/^blob:/)
  })

  it('renames and duplicates projects without reusing the project id', async () => {
    const project = projectWithAsset('原工程')
    await saveProject(project)

    const renamed = await renameProject(project.id, '  新名称  ')
    const duplicate = await duplicateProject(project.id)
    const summaries = await listProjectSummaries()

    expect(renamed.title).toBe('新名称')
    expect(duplicate.id).not.toBe(project.id)
    expect(duplicate.title).toContain('副本')
    expect(duplicate.assets[0].blob.size).toBe(project.assets[0].blob.size)
    expect(summaries).toHaveLength(2)
  })

  it('rejects stale thumbnail writes and can clear an obsolete preview', async () => {
    const project = createEmptyProject()
    await saveProject(project)
    const firstThumbnail = new NodeBlob(
      ['preview'],
      { type: 'image/webp' },
    ) as unknown as Blob
    expect(await saveProjectThumbnail(
      project.id,
      project.updatedAt,
      firstThumbnail,
    )).toBe(true)

    const previousUpdatedAt = project.updatedAt
    project.updatedAt = '2026-06-29T01:00:00.000Z'
    await saveProject(project)
    expect(await saveProjectThumbnail(
      project.id,
      previousUpdatedAt,
      new NodeBlob(['stale']) as unknown as Blob,
    )).toBe(false)
    expect((await listProjectSummaries())[0].thumbnail?.size).toBe(
      firstThumbnail.size,
    )

    expect(await saveProjectThumbnail(
      project.id,
      project.updatedAt,
      null,
    )).toBe(true)
    expect((await listProjectSummaries())[0].thumbnail).toBeNull()
  })

  it('deletes browser data and backup mappings without touching a folder', async () => {
    const project = createEmptyProject()
    await saveProject(project)
    await setLastOpenProjectId(project.id)
    await saveBackupPreferences({
      enabled: true,
      rootHandle: null,
      projectFolders: { [project.id]: 'managed-folder' },
      lastBackupAt: { [project.id]: '2026-01-01T00:00:00.000Z' },
      lastHistoryAt: { [project.id]: '2026-01-01T00:00:00.000Z' },
    })

    await deleteProject(project.id)

    expect(await loadProject(project.id)).toBeNull()
    expect(await getLastOpenProjectId()).toBeNull()
    expect((await loadBackupPreferences()).projectFolders).toEqual({})
  })

  it('migrates the legacy active project into the multi-project library', async () => {
    const project = createEmptyProject()
    const legacy = {
      ...project,
      schemaVersion: 1,
      style: {
        gap: project.style.gap,
        padding: project.style.padding,
        background: project.style.background,
        labelMode: project.style.labelMode,
        labelPosition: 'top-left',
        labelSize: 32,
        labelColor: project.style.labelColor,
      },
      assets: [],
    }
    const database = await openDB('layout-assistant', 3)
    await database.put('projects', legacy, 'active-project')
    database.close()

    const summaries = await listProjectSummaries()
    const restored = await loadProject(project.id)

    expect(summaries).toHaveLength(1)
    expect(restored?.schemaVersion).toBe(2)
    expect(restored?.style.labelFont).toBe('arial')
    expect(restored?.style.labelOffsetX).toBe(11.2)
    expect(restored?.style.labelParentheses).toBe(false)
    expect(await getLastOpenProjectId()).toBe(project.id)
  })

  it('rejects a project from an unknown future schema', async () => {
    const project = createEmptyProject()
    const database = await openDB('layout-assistant', 3)
    await database.put('projects', {
      ...project,
      schemaVersion: 3,
      assets: [],
    }, project.id)
    database.close()

    await expect(loadProject(project.id)).rejects.toThrow('版本不受支持')
  })
})
