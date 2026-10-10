import { MAX_TOTAL_BYTES } from '../constants'

export interface BridgeImportParams {
  port: number
  token: string
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,128}$/

export function parseBridgeImportHash(hash: string): BridgeImportParams {
  const normalized = hash.replace(/^#\/?/, '')
  const [route, query = ''] = normalized.split('?', 2)
  if (route !== 'bridge-import') {
    throw new Error('这不是有效的 Origin 导入链接。')
  }
  const params = new URLSearchParams(query)
  const port = Number(params.get('port'))
  const token = params.get('token') ?? ''
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Origin 助手端口无效。')
  }
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error('Origin 助手令牌无效或已缺失。')
  }
  return { port, token }
}

export function bridgeEndpoint(
  params: BridgeImportParams,
  resource: 'project' | 'complete',
) {
  return `http://127.0.0.1:${params.port}/v1/sessions/${encodeURIComponent(params.token)}/${resource}`
}

export async function fetchBridgeProject(
  params: BridgeImportParams,
): Promise<File> {
  let response: Response
  try {
    response = await fetch(bridgeEndpoint(params, 'project'), {
      method: 'GET',
      cache: 'no-store',
    })
  } catch {
    throw new Error('无法连接 Origin 批量排版助手。请确认助手仍在等待导入。')
  }
  if (!response.ok) {
    if (response.status === 410) {
      throw new Error('本次自动导入已过期，请手动导入 selected.figgrid。')
    }
    throw new Error(`Origin 助手返回错误（${response.status}）。`)
  }
  const declaredSize = Number(response.headers.get('content-length') ?? 0)
  if (declaredSize > MAX_TOTAL_BYTES + 10 * 1024 * 1024) {
    throw new Error('Origin 工程包超过网站允许的大小。')
  }
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength > MAX_TOTAL_BYTES + 10 * 1024 * 1024) {
    throw new Error('Origin 工程包超过网站允许的大小。')
  }
  return new File([bytes], 'origin-import.figgrid', {
    type: 'application/x-figgrid',
  })
}

export async function completeBridgeImport(params: BridgeImportParams) {
  try {
    await fetch(bridgeEndpoint(params, 'complete'), {
      method: 'POST',
      cache: 'no-store',
    })
  } catch {
    // The project is already saved locally. A missing acknowledgement is harmless.
  }
}
