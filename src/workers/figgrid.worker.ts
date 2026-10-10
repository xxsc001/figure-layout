import type { FigureProjectV2 } from '../types'
import { createFiggridBundle } from '../lib/project-file'

type WorkerRequest = { project: FigureProjectV2 }
type WorkerResponse =
  | { ok: true; bundle: Blob }
  | { ok: false; message: string }

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (message: WorkerResponse) => void
}

workerScope.onmessage = (event) => {
  void createFiggridBundle(event.data.project)
    .then((bundle) => workerScope.postMessage({ ok: true, bundle }))
    .catch((error: unknown) => {
      workerScope.postMessage({
        ok: false,
        message: error instanceof Error ? error.message : '工程打包失败。',
      })
    })
}
