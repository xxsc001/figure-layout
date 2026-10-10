import '../test/setup'
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { notifyWorkspaceChanged } from '../lib/workspace-events'
const mocks = vi.hoisted(() => ({ backup: vi.fn(async () => undefined) }))
vi.mock('../lib/folder-backup', () => ({ isFolderBackupSupported: () => true }))
vi.mock('../lib/workspace-backup', () => ({ backupWorkspace: mocks.backup }))
import { useAutomaticWorkspaceBackup } from './useWorkspaceBackup'
afterEach(() => vi.useRealTimers())
it('automatically updates after changes and coalesces rapid edits', async () => {
  vi.useFakeTimers()
  const view = renderHook(() => useAutomaticWorkspaceBackup())
  await act(async () => { await vi.advanceTimersByTimeAsync(2500) })
  expect(mocks.backup).toHaveBeenCalledTimes(1)
  act(() => notifyWorkspaceChanged())
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  act(() => notifyWorkspaceChanged())
  await act(async () => { await vi.advanceTimersByTimeAsync(2499) })
  expect(mocks.backup).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(1) })
  expect(mocks.backup).toHaveBeenCalledTimes(2)
  view.unmount()
})
