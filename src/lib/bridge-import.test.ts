import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bridgeEndpoint,
  fetchBridgeProject,
  parseBridgeImportHash,
} from './bridge-import'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Origin bridge imports', () => {
  it('parses a valid hash route', () => {
    expect(
      parseBridgeImportHash(
        '#/bridge-import?port=54321&token=abcdefghijklmnopqrstuvwxyz_123456',
      ),
    ).toEqual({ port: 54321, token: 'abcdefghijklmnopqrstuvwxyz_123456' })
  })

  it('rejects invalid ports and tokens', () => {
    expect(() => parseBridgeImportHash('#/bridge-import?port=80&token=short'))
      .toThrow('端口无效')
    expect(() => parseBridgeImportHash('#/bridge-import?port=54321&token=short'))
      .toThrow('令牌无效')
  })

  it('fetches a local figgrid without credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      new Blob(['bundle'], { type: 'application/x-figgrid' }),
      { status: 200, headers: { 'content-length': '6' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const params = { port: 54321, token: 'abcdefghijklmnopqrstuvwxyz_123456' }

    const file = await fetchBridgeProject(params)

    expect(file.name).toBe('origin-import.figgrid')
    expect(file.type).toBe('application/x-figgrid')
    expect(fetchMock).toHaveBeenCalledWith(
      bridgeEndpoint(params, 'project'),
      { method: 'GET', cache: 'no-store' },
    )
  })

  it('provides a recoverable message when the session expired', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 410 })))
    await expect(fetchBridgeProject({
      port: 54321,
      token: 'abcdefghijklmnopqrstuvwxyz_123456',
    })).rejects.toThrow('手动导入 selected.figgrid')
  })
})
