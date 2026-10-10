// @vitest-environment node
import { File as NodeFile } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { createEmptyProject, defaultPanelState } from './project'
import { createFiggridBundle, readFiggridBundle } from './project-file'

function projectWithTwoAssets() {
  const project = createEmptyProject()
  for (let index = 0; index < 2; index += 1) {
    const blob = new Blob([`image-${index}`], { type: 'image/png' })
    const id = `asset-${index}`
    project.assets.push({
      id,
      name: `panel-${index}.png`,
      mime: 'image/png',
      width: 100 + index,
      height: 80,
      size: blob.size,
      blob,
      previewUrl: `blob:${id}`,
    })
    project.panelOrder.push(id)
    project.panels[id] = defaultPanelState(id)
  }
  return project
}

describe('.figgrid project files', () => {
  it('round-trips its manifest, resources, and integrity hashes', async () => {
    const source = projectWithTwoAssets()
    source.style.labelParentheses = true
    const bundle = await createFiggridBundle(source)
    const file = new NodeFile([new Uint8Array(await bundle.arrayBuffer())], 'fixture.figgrid', {
      type: 'application/x-figgrid',
    }) as unknown as File
    const restored = await readFiggridBundle(file)

    expect(restored.schemaVersion).toBe(2)
    expect(restored.panelOrder).toEqual(source.panelOrder)
    expect(restored.assets.map((asset) => asset.name)).toEqual(
      source.assets.map((asset) => asset.name),
    )
    expect(restored.assets[0].blob.size).toBe(source.assets[0].blob.size)
    expect(restored.style.labelFont).toBe('arial')
    expect(restored.style.labelParentheses).toBe(true)
  })

  it('rejects a corrupt project file', async () => {
    const file = new NodeFile(['not-a-zip'], 'broken.figgrid') as unknown as File
    await expect(readFiggridBundle(file)).rejects.toThrow()
  })

  it('migrates a V1 project and preserves its previous label inset', async () => {
    const legacyManifest = {
      schemaVersion: 1,
      id: 'legacy-project',
      title: 'Legacy Figure',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      assets: [],
      panelOrder: [],
      panels: {},
      layoutProfile: 'classic',
      style: {
        gap: 20,
        padding: 24,
        background: '#ffffff',
        labelMode: 'uppercase',
        labelPosition: 'top-right',
        labelSize: 40,
        labelColor: '#111827',
      },
      exportSettings: { width: 3000 },
    }
    const zipped = zipSync({
      'manifest.json': strToU8(JSON.stringify(legacyManifest)),
    })
    const file = new NodeFile([zipped], 'legacy.figgrid', {
      type: 'application/x-figgrid',
    }) as unknown as File

    const restored = await readFiggridBundle(file)

    expect(restored.schemaVersion).toBe(2)
    expect(restored.style.labelFont).toBe('arial')
    expect(restored.style.labelWeight).toBe(700)
    expect(restored.style.labelPosition).toBe('top-right')
    expect(restored.style.labelOffsetX).toBe(14)
    expect(restored.style.labelOffsetY).toBe(14)
    expect(restored.style.labelParentheses).toBe(false)
  })

  it('rejects project versions newer than the current schema', async () => {
    const zipped = zipSync({
      'manifest.json': strToU8(JSON.stringify({ schemaVersion: 3 })),
    })
    const file = new NodeFile([zipped], 'future.figgrid') as unknown as File

    await expect(readFiggridBundle(file)).rejects.toThrow('版本不受支持')
  })
})
