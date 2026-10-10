import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  BackupPermissionState,
  BackupPreferences,
  BackupStatus,
  FigureProjectV2,
} from '../types'
import {
  BACKUP_DEBOUNCE_MS,
  HISTORY_INTERVAL_MS,
  createProjectBackupFolderName,
  isFolderBackupSupported,
  queryBackupPermission,
  requestBackupPermission,
  selectBackupDirectory,
  writeBackupBundle,
} from '../lib/folder-backup'
import { createFiggridBundleInWorker } from '../lib/figgrid-worker'
import {
  DEFAULT_BACKUP_PREFERENCES,
  loadBackupPreferences,
  saveBackupPreferences,
} from '../lib/storage'

export interface FolderBackupController {
  supported: boolean
  loaded: boolean
  enabled: boolean
  permission: BackupPermissionState
  status: BackupStatus
  rootFolderName: string | null
  projectFolderName: string | null
  lastBackupAt: string | null
  error: string | null
  selectFolder: () => Promise<void>
  reauthorize: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
  backupNow: () => Promise<Blob | null>
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isPermissionError(error: unknown) {
  return error instanceof DOMException && error.name === 'NotAllowedError'
}

export function useFolderBackup(
  project: FigureProjectV2,
  hydrated: boolean,
): FolderBackupController {
  const supported = isFolderBackupSupported()
  const [loaded, setLoaded] = useState(false)
  const [preferences, setPreferencesState] = useState<BackupPreferences>(
    DEFAULT_BACKUP_PREFERENCES,
  )
  const [permission, setPermissionState] = useState<BackupPermissionState>(
    supported ? 'prompt' : 'unsupported',
  )
  const [status, setStatus] = useState<BackupStatus>(
    supported ? 'disabled' : 'unsupported',
  )
  const [error, setError] = useState<string | null>(null)

  const projectRef = useRef(project)
  const preferencesRef = useRef(preferences)
  const permissionRef = useRef<BackupPermissionState>(permission)
  const timerRef = useRef<number | null>(null)
  const activeBackupRef = useRef<Promise<Blob | null> | null>(null)
  const pendingSnapshotRef = useRef<FigureProjectV2 | null>(null)
  const pendingCountRef = useRef(0)
  const dirtyRef = useRef(false)
  const mountedRef = useRef(true)

  projectRef.current = project

  const setPermission = useCallback((next: BackupPermissionState) => {
    permissionRef.current = next
    setPermissionState(next)
  }, [])

  const persistPreferences = useCallback(async (next: BackupPreferences) => {
    preferencesRef.current = next
    if (mountedRef.current) setPreferencesState(next)
    await saveBackupPreferences(next)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadBackupPreferences()
      .then(async (stored) => {
        if (cancelled) return
        preferencesRef.current = stored
        setPreferencesState(stored)
        if (!supported) {
          setPermission('unsupported')
          setStatus('unsupported')
          return
        }
        if (!stored.enabled || !stored.rootHandle) {
          setStatus('disabled')
          setPermission(stored.rootHandle ? 'prompt' : 'prompt')
          return
        }
        const currentPermission = await queryBackupPermission(stored.rootHandle)
        if (cancelled) return
        setPermission(currentPermission)
        setStatus(currentPermission === 'granted' ? 'idle' : 'needs-permission')
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(supported ? 'error' : 'unsupported')
          setError('无法读取文件夹备份设置。')
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [setPermission, supported])

  const performBackup = useCallback(async (snapshot: FigureProjectV2) => {
    const current = preferencesRef.current
    if (
      !supported ||
      !current.enabled ||
      !current.rootHandle ||
      permissionRef.current !== 'granted'
    ) {
      return null
    }

    pendingCountRef.current += 1
    if (mountedRef.current) {
      setStatus('writing')
      setError(null)
    }

    let successful = false
    try {
      const currentPermission = await queryBackupPermission(current.rootHandle)
      setPermission(currentPermission)
      if (currentPermission !== 'granted') {
        setStatus('needs-permission')
        dirtyRef.current = true
        return null
      }

      let folderName = current.projectFolders[snapshot.id]
      let workingPreferences = current
      if (!folderName) {
        folderName = createProjectBackupFolderName(snapshot)
        workingPreferences = {
          ...current,
          projectFolders: {
            ...current.projectFolders,
            [snapshot.id]: folderName,
          },
        }
        await persistPreferences(workingPreferences)
      }

      const now = new Date()
      const previousHistoryAt = workingPreferences.lastHistoryAt[snapshot.id]
      const createHistory =
        !previousHistoryAt ||
        now.getTime() - new Date(previousHistoryAt).getTime() >= HISTORY_INTERVAL_MS
      const bundle = await createFiggridBundleInWorker(snapshot)
      const result = await writeBackupBundle({
        rootHandle: workingPreferences.rootHandle!,
        projectFolderName: folderName,
        bundle,
        createHistory,
        now,
      })

      const isoTime = now.toISOString()
      const nextPreferences: BackupPreferences = {
        ...preferencesRef.current,
        lastBackupAt: {
          ...preferencesRef.current.lastBackupAt,
          [snapshot.id]: isoTime,
        },
        lastHistoryAt: result.historyFileName
          ? {
              ...preferencesRef.current.lastHistoryAt,
              [snapshot.id]: isoTime,
            }
          : preferencesRef.current.lastHistoryAt,
      }
      await persistPreferences(nextPreferences)
      if (projectRef.current.updatedAt === snapshot.updatedAt) {
        dirtyRef.current = false
      }
      successful = true
      return bundle
    } catch (backupError) {
      dirtyRef.current = true
      if (isPermissionError(backupError)) {
        setPermission('prompt')
        if (mountedRef.current) setStatus('needs-permission')
      } else if (mountedRef.current) {
        await persistPreferences({
          ...preferencesRef.current,
          enabled: false,
        }).catch(() => undefined)
        setStatus('error')
        setError(
          backupError instanceof Error
            ? backupError.message
            : '文件夹备份失败。',
        )
      }
      return null
    } finally {
      pendingCountRef.current -= 1
      if (
        mountedRef.current &&
        successful &&
        pendingCountRef.current === 0 &&
        permissionRef.current === 'granted'
      ) {
        setStatus(dirtyRef.current ? 'scheduled' : 'idle')
      }
    }
  }, [persistPreferences, setPermission, supported])

  const enqueueBackup = useCallback((snapshot: FigureProjectV2) => {
    pendingSnapshotRef.current = snapshot
    if (!activeBackupRef.current) {
      activeBackupRef.current = (async () => {
        let latestBundle: Blob | null = null
        while (pendingSnapshotRef.current) {
          const nextSnapshot = pendingSnapshotRef.current
          pendingSnapshotRef.current = null
          latestBundle = await performBackup(nextSnapshot)
        }
        return latestBundle
      })().finally(() => {
        activeBackupRef.current = null
      })
    }
    return activeBackupRef.current
  }, [performBackup])

  const backupNow = useCallback(async () => {
    clearTimer()
    const current = preferencesRef.current
    if (
      !supported ||
      !current.enabled ||
      !current.rootHandle ||
      permissionRef.current !== 'granted'
    ) {
      return null
    }
    dirtyRef.current = true
    return enqueueBackup(projectRef.current)
  }, [clearTimer, enqueueBackup, supported])

  const selectFolder = useCallback(async () => {
    try {
      const rootHandle = await selectBackupDirectory()
      const next: BackupPreferences = {
        enabled: true,
        rootHandle,
        projectFolders: {},
        lastBackupAt: {},
        lastHistoryAt: {},
      }
      await persistPreferences(next)
      setPermission('granted')
      dirtyRef.current = true
      setStatus('scheduled')
      await enqueueBackup(projectRef.current)
    } catch (selectionError) {
      if (isAbortError(selectionError)) return
      if (mountedRef.current) {
        setStatus('error')
        setError(
          selectionError instanceof Error
            ? selectionError.message
            : '无法选择备份文件夹。',
        )
      }
    }
  }, [enqueueBackup, persistPreferences, setPermission])

  const reauthorize = useCallback(async () => {
    const handle = preferencesRef.current.rootHandle
    if (!handle) {
      await selectFolder()
      return
    }
    try {
      const nextPermission = await requestBackupPermission(handle)
      setPermission(nextPermission)
      if (nextPermission !== 'granted') {
        setStatus('needs-permission')
        return
      }
      await persistPreferences({ ...preferencesRef.current, enabled: true })
      dirtyRef.current = true
      await enqueueBackup(projectRef.current)
    } catch (permissionError) {
      setStatus('needs-permission')
      setError(
        permissionError instanceof Error
          ? permissionError.message
          : '文件夹授权失败。',
      )
    }
  }, [enqueueBackup, persistPreferences, selectFolder, setPermission])

  const setEnabled = useCallback(async (enabled: boolean) => {
    if (enabled && !preferencesRef.current.rootHandle) {
      await selectFolder()
      return
    }
    if (enabled && permissionRef.current !== 'granted') {
      await reauthorize()
      return
    }
    clearTimer()
    await persistPreferences({ ...preferencesRef.current, enabled })
    setStatus(enabled ? 'idle' : 'disabled')
    if (enabled) {
      dirtyRef.current = true
      await enqueueBackup(projectRef.current)
    }
  }, [clearTimer, enqueueBackup, persistPreferences, reauthorize, selectFolder])

  useEffect(() => {
    if (!loaded || !hydrated) return
    dirtyRef.current = true
    const current = preferencesRef.current
    if (
      !supported ||
      !current.enabled ||
      !current.rootHandle ||
      permissionRef.current !== 'granted'
    ) {
      return
    }
    clearTimer()
    if (pendingCountRef.current === 0) setStatus('scheduled')
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void enqueueBackup(projectRef.current)
    }, BACKUP_DEBOUNCE_MS)
  }, [clearTimer, enqueueBackup, hydrated, loaded, project.updatedAt, supported])

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (
        preferencesRef.current.enabled &&
        (dirtyRef.current || pendingCountRef.current > 0)
      ) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [])

  return {
    supported,
    loaded,
    enabled: preferences.enabled,
    permission,
    status,
    rootFolderName: preferences.rootHandle?.name ?? null,
    projectFolderName: preferences.projectFolders[project.id] ?? null,
    lastBackupAt: preferences.lastBackupAt[project.id] ?? null,
    error,
    selectFolder,
    reauthorize,
    setEnabled,
    backupNow,
  }
}
