import type { FigureProjectV2 } from '../types'
import { createFiggridBundle } from './project-file'

type WorkerResponse =
  | { ok: true; bundle: Blob }
  | { ok: false; message: string }

export async function createFiggridBundleInWorker(
  project: FigureProjectV2,
): Promise<Blob> {
  if (typeof Worker === 'undefined') return createFiggridBundle(project)

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/figgrid.worker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      worker.terminate()
      if (event.data.ok) resolve(event.data.bundle)
      else reject(new Error(event.data.message))
    }
    worker.onerror = () => {
      worker.terminate()
      reject(new Error('浏览器无法启动工程备份任务。'))
    }
    worker.postMessage({ project })
  })
}
