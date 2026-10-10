import { useEffect, useSyncExternalStore } from 'react'
import { WORKSPACE_CHANGED } from '../lib/workspace-events'
import { isFolderBackupSupported } from '../lib/folder-backup'
import { backupWorkspace, getWorkspaceBackupState, subscribeWorkspaceBackup } from '../lib/workspace-backup'

export function useAutomaticWorkspaceBackup() {
  useEffect(() => {
    if (!isFolderBackupSupported()) return
    let timer: number | undefined
    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { void backupWorkspace().catch(() => undefined) }, 2500)
    }
    window.addEventListener(WORKSPACE_CHANGED, schedule)
    schedule()
    const flush = () => { window.clearTimeout(timer); void backupWorkspace().catch(() => undefined) }
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { window.clearTimeout(timer); window.removeEventListener(WORKSPACE_CHANGED, schedule); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])
}
export function useWorkspaceBackupStatus() {
  return useSyncExternalStore(subscribeWorkspaceBackup, getWorkspaceBackupState)
}
