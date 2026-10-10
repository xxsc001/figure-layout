import type { FigureProjectV2 } from '../types'

export const BACKUP_DEBOUNCE_MS = 2_000
export const HISTORY_INTERVAL_MS = 5 * 60_000
export const HISTORY_LIMIT = 10

const HISTORY_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.figgrid$/

export function isFolderBackupSupported() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof window.showDirectoryPicker === 'function'
  )
}

export async function selectBackupDirectory() {
  if (!isFolderBackupSupported() || !window.showDirectoryPicker) {
    throw new Error('当前浏览器或访问方式不支持文件夹备份。')
  }
  return window.showDirectoryPicker({
    id: 'paper-figure-layout-backups',
    mode: 'readwrite',
    startIn: 'documents',
  })
}

export async function queryBackupPermission(
  handle: FileSystemDirectoryHandle,
) {
  return handle.queryPermission({ mode: 'readwrite' })
}

export async function requestBackupPermission(
  handle: FileSystemDirectoryHandle,
) {
  return handle.requestPermission({ mode: 'readwrite' })
}

function sanitizePathSegment(value: string) {
  return Array.from(value.trim())
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/[. ]+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 60)
}

export function createProjectBackupFolderName(
  project: Pick<FigureProjectV2, 'id' | 'title'>,
) {
  const safeTitle = sanitizePathSegment(project.title) || '未命名-Figure'
  const shortId = project.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'project'
  return `${safeTitle}-${shortId}`
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function createHistoryFileName(date: Date) {
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    '-',
    pad(date.getMinutes()),
    '-',
    pad(date.getSeconds()),
    '.figgrid',
  ].join('')
}

export async function writeBlob(
  directory: FileSystemDirectoryHandle,
  fileName: string,
  blob: Blob,
) {
  const fileHandle = await directory.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  try {
    await writable.write(blob)
    await writable.close()
  } catch (error) {
    await writable.abort().catch(() => undefined)
    throw error
  }
}

export async function pruneManagedHistory(
  historyDirectory: FileSystemDirectoryHandle,
  limit = HISTORY_LIMIT,
) {
  const managedFiles: string[] = []
  for await (const [name, handle] of historyDirectory.entries()) {
    if (handle.kind === 'file' && HISTORY_FILE_PATTERN.test(name)) {
      managedFiles.push(name)
    }
  }
  managedFiles.sort()
  const expired = managedFiles.slice(0, Math.max(0, managedFiles.length - limit))
  await Promise.all(expired.map((name) => historyDirectory.removeEntry(name)))
  return expired
}

export interface WriteBackupOptions {
  rootHandle: FileSystemDirectoryHandle
  projectFolderName: string
  bundle: Blob
  createHistory: boolean
  now?: Date
}

async function performBackupWrite({
  rootHandle,
  projectFolderName,
  bundle,
  createHistory,
  now = new Date(),
}: WriteBackupOptions) {
  const projectDirectory = await rootHandle.getDirectoryHandle(
    projectFolderName,
    { create: true },
  )
  await writeBlob(projectDirectory, 'latest.figgrid', bundle)

  let historyFileName: string | null = null
  if (createHistory) {
    const historyDirectory = await projectDirectory.getDirectoryHandle(
      'history',
      { create: true },
    )
    historyFileName = createHistoryFileName(now)
    await writeBlob(historyDirectory, historyFileName, bundle)
    await pruneManagedHistory(historyDirectory)
  }

  return { historyFileName }
}

// Serialize writers sharing a root directory, including editor and library backups.
const backupWrites = new WeakMap<FileSystemDirectoryHandle, Promise<unknown>>()
export function writeBackupBundle(options: WriteBackupOptions) {
  const previous = backupWrites.get(options.rootHandle) || Promise.resolve()
  const next = previous.catch(() => undefined).then(() => performBackupWrite(options))
  backupWrites.set(options.rootHandle, next)
  return next
}
