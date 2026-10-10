import { describe, expect, it } from 'vitest'
import {
  createHistoryFileName,
  createProjectBackupFolderName,
  pruneManagedHistory,
  writeBackupBundle,
} from './folder-backup'

class MemoryFileHandle {
  readonly kind = 'file' as const

  constructor(
    readonly name: string,
    private readonly files: Map<string, Blob>,
  ) {}

  async createWritable() {
    let pending: Blob | null = null
    return {
      write: async (data: FileSystemWriteChunkType) => {
        pending = data instanceof Blob ? data : new Blob([data as BlobPart])
      },
      close: async () => {
        if (pending) this.files.set(this.name, pending)
      },
      abort: async () => {
        pending = null
      },
    } as FileSystemWritableFileStream
  }
}

class MemoryDirectoryHandle {
  readonly kind = 'directory' as const
  readonly files = new Map<string, Blob>()
  readonly directories = new Map<string, MemoryDirectoryHandle>()

  constructor(readonly name: string) {}

  async queryPermission() {
    return 'granted' as PermissionState
  }

  async requestPermission() {
    return 'granted' as PermissionState
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!options?.create && !this.files.has(name)) {
      throw new DOMException('Missing file', 'NotFoundError')
    }
    return new MemoryFileHandle(
      name,
      this.files,
    ) as unknown as FileSystemFileHandle
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    let directory = this.directories.get(name)
    if (!directory && options?.create) {
      directory = new MemoryDirectoryHandle(name)
      this.directories.set(name, directory)
    }
    if (!directory) throw new DOMException('Missing directory', 'NotFoundError')
    return directory as unknown as FileSystemDirectoryHandle
  }

  async removeEntry(name: string) {
    this.files.delete(name)
    this.directories.delete(name)
  }

  async *entries(): AsyncIterableIterator<[
    string,
    FileSystemFileHandle | FileSystemDirectoryHandle,
  ]> {
    for (const name of this.files.keys()) {
      yield [
        name,
        new MemoryFileHandle(
          name,
          this.files,
        ) as unknown as FileSystemFileHandle,
      ]
    }
    for (const [name, directory] of this.directories) {
      yield [name, directory as unknown as FileSystemDirectoryHandle]
    }
  }
}

describe('folder backups', () => {
  it('creates a stable safe project folder name', () => {
    expect(
      createProjectBackupFolderName({
        id: '12345678-abcd-efgh',
        title: '论文：Figure 1 / 最终版. ',
      }),
    ).toBe('论文：Figure 1 - 最终版-12345678')
  })

  it('formats history names with local time', () => {
    expect(createHistoryFileName(new Date(2026, 5, 8, 9, 7, 6))).toBe(
      '2026-06-08_09-07-06.figgrid',
    )
  })

  it('updates latest, keeps ten managed snapshots and preserves other files', async () => {
    const root = new MemoryDirectoryHandle('backups')
    const folderName = '项目-12345678'

    for (let index = 0; index < 12; index += 1) {
      const bundle = new Blob([`version-${index}`])
      await writeBackupBundle({
        rootHandle: root as unknown as FileSystemDirectoryHandle,
        projectFolderName: folderName,
        bundle,
        createHistory: true,
        now: new Date(2026, 0, 1, 10, 0, index),
      })
    }

    const projectDirectory = root.directories.get(folderName)!
    const historyDirectory = projectDirectory.directories.get('history')!
    historyDirectory.files.set('notes.txt', new Blob(['do not delete']))
    historyDirectory.files.set('manual-copy.figgrid', new Blob(['keep']))

    const removed = await pruneManagedHistory(
      historyDirectory as unknown as FileSystemDirectoryHandle,
    )

    expect(removed).toEqual([])
    const latestText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(projectDirectory.files.get('latest.figgrid')!)
    })
    expect(latestText).toBe('version-11')
    expect(
      [...historyDirectory.files.keys()].filter((name) =>
        /^\d{4}-\d{2}-\d{2}_/.test(name),
      ),
    ).toHaveLength(10)
    expect(historyDirectory.files.has('notes.txt')).toBe(true)
    expect(historyDirectory.files.has('manual-copy.figgrid')).toBe(true)
    expect(historyDirectory.files.has('2026-01-01_10-00-00.figgrid')).toBe(false)
    expect(historyDirectory.files.has('2026-01-01_10-00-11.figgrid')).toBe(true)
  })
})
