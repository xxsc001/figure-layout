import { hasWorkspaceBackup } from '../lib/workspace-backup'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  BackupPermissionState,
  BackupPreferences,
} from '../types'
import {
  isFolderBackupSupported,
  queryBackupPermission,
  requestBackupPermission,
  selectBackupDirectory,
} from '../lib/folder-backup'
import {
  DEFAULT_BACKUP_PREFERENCES,
  loadBackupPreferences,
  saveBackupPreferences,
} from '../lib/storage'

export interface BackupSettingsController {
  supported: boolean
  loaded: boolean
  enabled: boolean
  permission: BackupPermissionState
  rootFolderName: string | null
  lastBackupAt: string | null
  error: string | null
  refreshSettings: () => Promise<void>
  selectFolder: () => Promise<void>
  reauthorize: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function useBackupSettings(): BackupSettingsController {
  const supported = isFolderBackupSupported()
  const [loaded, setLoaded] = useState(false)
  const [preferences, setPreferences] = useState<BackupPreferences>(
    DEFAULT_BACKUP_PREFERENCES,
  )
  const [permission, setPermission] = useState<BackupPermissionState>(
    supported ? 'prompt' : 'unsupported',
  )
  const [error, setError] = useState<string | null>(null)

  const persist = useCallback(async (next: BackupPreferences) => {
    await saveBackupPreferences(next)
    setPreferences(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadBackupPreferences()
      .then(async (stored) => {
        if (cancelled) return
        setPreferences(stored)
        if (!supported) {
          setPermission('unsupported')
          return
        }
        if (!stored.rootHandle) {
          setPermission('prompt')
          return
        }
        const nextPermission = await queryBackupPermission(stored.rootHandle)
        if (!cancelled) setPermission(nextPermission)
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error
            ? loadError.message
            : '无法读取备份设置。')
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [supported])

  const selectFolder = useCallback(async () => {
    setError(null)
    try {
      const rootHandle = await selectBackupDirectory()
      if (await hasWorkspaceBackup(rootHandle)) throw new Error('此目录已有备份，请使用下方“一键恢复”读取，避免覆盖原有数据。')
      await persist({
        enabled: true,
        rootHandle,
        projectFolders: {},
        lastBackupAt: {},
        lastHistoryAt: {},
      })
      setPermission('granted')
    } catch (selectionError) {
      if (isAbortError(selectionError)) return
      setError(selectionError instanceof Error
        ? selectionError.message
        : '无法选择备份文件夹。')
    }
  }, [persist])

  const reauthorize = useCallback(async () => {
    if (!preferences.rootHandle) {
      await selectFolder()
      return
    }
    setError(null)
    try {
      const nextPermission = await requestBackupPermission(
        preferences.rootHandle,
      )
      setPermission(nextPermission)
      if (nextPermission === 'granted') {
        await persist({ ...preferences, enabled: true })
      }
    } catch (permissionError) {
      setError(permissionError instanceof Error
        ? permissionError.message
        : '文件夹授权失败。')
    }
  }, [persist, preferences, selectFolder])

  const setEnabled = useCallback(async (enabled: boolean) => {
    if (enabled && !preferences.rootHandle) {
      await selectFolder()
      return
    }
    if (enabled && permission !== 'granted') {
      await reauthorize()
      return
    }
    await persist({ ...preferences, enabled })
  }, [permission, persist, preferences, reauthorize, selectFolder])

  const refreshSettings = useCallback(async () => {
    const next = await loadBackupPreferences()
    setPreferences(next)
    setPermission(next.rootHandle && supported ? await queryBackupPermission(next.rootHandle) : supported ? 'prompt' : 'unsupported')
  }, [supported])

  const lastBackupAt = useMemo(() => {
    const times = Object.values(preferences.lastBackupAt).sort()
    return times.at(-1) ?? null
  }, [preferences.lastBackupAt])

  return {
    supported,
    loaded,
    enabled: preferences.enabled,
    permission,
    rootFolderName: preferences.rootHandle?.name ?? null,
    lastBackupAt,
    error,
    refreshSettings,
    selectFolder,
    reauthorize,
    setEnabled,
  }
}
