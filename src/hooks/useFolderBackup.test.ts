import '../test/setup'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '../lib/project'
import type { BackupPreferences } from '../types'

const mocks = vi.hoisted(() => ({
  loadPreferences: vi.fn(),
  savePreferences: vi.fn(),
  queryPermission: vi.fn(),
  requestPermission: vi.fn(),
  selectDirectory: vi.fn(),
  writeBundle: vi.fn(),
  createBundle: vi.fn(),
}))

vi.mock('../lib/storage', () => ({
  DEFAULT_BACKUP_PREFERENCES: {
    enabled: false,
    rootHandle: null,
    projectFolders: {},
    lastBackupAt: {},
    lastHistoryAt: {},
  },
  loadBackupPreferences: mocks.loadPreferences,
  saveBackupPreferences: mocks.savePreferences,
}))

vi.mock('../lib/folder-backup', () => ({
  BACKUP_DEBOUNCE_MS: 2_000,
  HISTORY_INTERVAL_MS: 5 * 60_000,
  isFolderBackupSupported: () => true,
  createProjectBackupFolderName: () => '未命名 Figure-12345678',
  queryBackupPermission: mocks.queryPermission,
  requestBackupPermission: mocks.requestPermission,
  selectBackupDirectory: mocks.selectDirectory,
  writeBackupBundle: mocks.writeBundle,
}))

vi.mock('../lib/figgrid-worker', () => ({
  createFiggridBundleInWorker: mocks.createBundle,
}))

import { useFolderBackup } from './useFolderBackup'

const rootHandle = { name: '科研备份' } as FileSystemDirectoryHandle

function preferences(
  patch: Partial<BackupPreferences> = {},
): BackupPreferences {
  return {
    enabled: true,
    rootHandle,
    projectFolders: {},
    lastBackupAt: {},
    lastHistoryAt: {},
    ...patch,
  }
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useFolderBackup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-28T10:00:00.000Z'))
    mocks.loadPreferences.mockResolvedValue(preferences())
    mocks.savePreferences.mockResolvedValue(undefined)
    mocks.queryPermission.mockResolvedValue('granted')
    mocks.requestPermission.mockResolvedValue('granted')
    mocks.selectDirectory.mockResolvedValue(rootHandle)
    mocks.createBundle.mockResolvedValue(new Blob(['project']))
    mocks.writeBundle.mockImplementation(
      async ({ createHistory }: { createHistory: boolean }) => ({
        historyFileName: createHistory
          ? '2026-06-28_18-00-00.figgrid'
          : null,
      }),
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('backs up after two idle seconds and throttles history snapshots', async () => {
    const project = createEmptyProject()
    const { result, rerender } = renderHook(
      ({ currentProject }) => useFolderBackup(currentProject, true),
      { initialProps: { currentProject: project } },
    )
    await flushAsyncWork()
    expect(result.current.loaded).toBe(true)

    await act(async () => vi.advanceTimersByTimeAsync(1_999))
    expect(mocks.writeBundle).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(1))
    await flushAsyncWork()

    expect(mocks.writeBundle).toHaveBeenCalledTimes(1)
    expect(mocks.writeBundle.mock.calls[0][0].createHistory).toBe(true)
    expect(result.current.status).toBe('idle')

    rerender({
      currentProject: {
        ...project,
        updatedAt: '2026-06-28T10:01:00.000Z',
      },
    })
    await act(async () => vi.advanceTimersByTimeAsync(2_000))
    await flushAsyncWork()

    expect(mocks.writeBundle).toHaveBeenCalledTimes(2)
    expect(mocks.writeBundle.mock.calls[1][0].createHistory).toBe(false)
  })

  it('waits for a user gesture when stored permission needs renewal', async () => {
    mocks.queryPermission.mockResolvedValueOnce('prompt')
    const { result } = renderHook(() =>
      useFolderBackup(createEmptyProject(), true),
    )
    await flushAsyncWork()

    expect(result.current.status).toBe('needs-permission')
    expect(mocks.requestPermission).not.toHaveBeenCalled()

    await act(async () => result.current.reauthorize())
    await flushAsyncWork()

    expect(mocks.requestPermission).toHaveBeenCalledWith(rootHandle)
    expect(mocks.writeBundle).toHaveBeenCalledTimes(1)
    expect(result.current.permission).toBe('granted')
  })

  it('pauses automatic backups after a write failure', async () => {
    mocks.writeBundle.mockRejectedValueOnce(new Error('磁盘空间不足'))
    const { result } = renderHook(() =>
      useFolderBackup(createEmptyProject(), true),
    )
    await flushAsyncWork()
    await act(async () => vi.advanceTimersByTimeAsync(2_000))
    await flushAsyncWork()

    expect(result.current.status).toBe('error')
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toBe('磁盘空间不足')
    expect(mocks.savePreferences).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    )
  })

  it('serializes writes and merges newer pending edits', async () => {
    let releaseFirstWrite: ((value: { historyFileName: string }) => void) | null = null
    mocks.writeBundle
      .mockImplementationOnce(() => new Promise((resolve) => {
        releaseFirstWrite = resolve
      }))
      .mockResolvedValue({ historyFileName: null })

    const project = createEmptyProject()
    const { rerender } = renderHook(
      ({ currentProject }) => useFolderBackup(currentProject, true),
      { initialProps: { currentProject: project } },
    )
    await flushAsyncWork()
    await act(async () => vi.advanceTimersByTimeAsync(2_000))
    await flushAsyncWork()
    expect(mocks.writeBundle).toHaveBeenCalledTimes(1)

    rerender({
      currentProject: { ...project, updatedAt: '2026-06-28T10:01:00.000Z' },
    })
    await act(async () => vi.advanceTimersByTimeAsync(2_000))
    rerender({
      currentProject: { ...project, updatedAt: '2026-06-28T10:02:00.000Z' },
    })
    await act(async () => vi.advanceTimersByTimeAsync(2_000))
    expect(mocks.writeBundle).toHaveBeenCalledTimes(1)

    await act(async () => {
      releaseFirstWrite?.({ historyFileName: 'first.figgrid' })
      await Promise.resolve()
    })
    await flushAsyncWork()

    expect(mocks.writeBundle).toHaveBeenCalledTimes(2)
    expect(mocks.createBundle).toHaveBeenCalledTimes(2)
  })

  it('keeps existing settings when the folder picker is cancelled', async () => {
    mocks.loadPreferences.mockResolvedValue(preferences({
      enabled: false,
      rootHandle: null,
    }))
    mocks.selectDirectory.mockRejectedValue(
      new DOMException('Cancelled', 'AbortError'),
    )
    const { result } = renderHook(() =>
      useFolderBackup(createEmptyProject(), true),
    )
    await flushAsyncWork()

    await act(async () => result.current.selectFolder())

    expect(result.current.status).toBe('disabled')
    expect(result.current.error).toBeNull()
    expect(mocks.savePreferences).not.toHaveBeenCalled()
  })
})
