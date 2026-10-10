import { expect, test } from '@playwright/test'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { strToU8, zipSync } from 'fflate'
import { createServer, type ViteDevServer } from 'vite'
let server: ViteDevServer

test.beforeAll(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { host: '127.0.0.1', port: 4174, strictPort: true },
    logLevel: 'silent',
  })
  await server.listen()
})

test.afterAll(async () => {
  await server.close()
})
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

function imageFiles(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `panel-${index + 1}.png`,
    mimeType: 'image/png',
    buffer: png,
  }))
}

function bridgeFiggrid() {
  const now = new Date().toISOString()
  const assets = Array.from({ length: 2 }, (_, index) => {
    const id = randomUUID()
    return {
      id,
      name: `origin-${index + 1}.png`,
      mime: 'image/png',
      width: 1,
      height: 1,
      size: png.byteLength,
      path: `assets/${id}.png`,
      sha256: createHash('sha256').update(png).digest('hex'),
    }
  })
  const manifest = {
    schemaVersion: 2,
    id: randomUUID(),
    title: 'Origin 自动导入',
    createdAt: now,
    updatedAt: now,
    assets,
    panelOrder: assets.map((asset) => asset.id),
    panels: Object.fromEntries(assets.map((asset) => [asset.id, {
      assetId: asset.id,
      fit: 'contain',
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      hiddenLabel: false,
    }])),
    layoutProfile: 'classic',
    exportSettings: { width: 3000 },
    style: {
      gap: 20,
      padding: 24,
      background: '#ffffff',
      labelMode: 'uppercase',
      labelPosition: 'top-left',
      labelFont: 'arial',
      labelWeight: 700,
      labelOffsetX: 13,
      labelOffsetY: 13,
      labelSize: 36,
      labelColor: '#111827',
    },
  }
  return Buffer.from(zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest)),
    ...Object.fromEntries(assets.map((asset) => [asset.path, png])),
  }))
}

async function createProject(page: import('@playwright/test').Page) {
  await page.goto('/#projects')
  await expect(page.getByRole('heading', { name: '我的工程' })).toBeVisible()
  await page.locator('.new-project-card').click()
  await expect(page).toHaveURL(/#editor\/.+/)
  await expect(page.getByTestId('image-input')).toBeAttached()
}

async function openEditorSection(
  page: import('@playwright/test').Page,
  name: string,
) {
  const toggle = page.locator('.collapsible-trigger').filter({ hasText: name }).first()
  if (await toggle.getAttribute('aria-expanded') === 'false') {
    await toggle.click()
  }
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  return toggle
}

test('landing page introduces the product and opens the editor', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /让科研排图/ })).toBeVisible()
  await expect(page.locator('.landing-hero')).toHaveScreenshot('landing-hero.png', {
    animations: 'disabled',
  })
  await page.getByRole('button', { name: /立即开始/ }).click()
  await expect(page.getByRole('heading', { name: '我的工程' })).toBeVisible()
  const importButton = page.getByRole('button', { name: '导入工程' })
  expect((await importButton.boundingBox())!.width).toBeGreaterThanOrEqual(96)
  expect((await importButton.boundingBox())!.height).toBeLessThan(50)
  expect(await page.locator('.dashboard-sidebar nav button').first().evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).fontSize),
  )).toBeGreaterThanOrEqual(14)
  expect(await page.locator('.projects-page .dashboard-page-header h1').evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).fontSize),
  )).toBeGreaterThanOrEqual(34)
  await expect(page.locator('.dashboard-shell')).toHaveScreenshot('project-center.png', {
    animations: 'disabled',
  })
  await page.locator('.new-project-card').click()
  await expect(page.locator('.workspace')).toBeVisible()
  await expect(page.getByTestId('image-input')).toBeAttached()
  await expect(page).toHaveURL(/#editor\/.+$/)
})

test('Origin bridge imports a local figgrid and acknowledges completion', async ({ page }) => {
  const token = 'abcdefghijklmnopqrstuvwxyz_123456'
  const bundle = bridgeFiggrid()
  let completed = false
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    if (route.request().method() === 'POST') {
      completed = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/x-figgrid',
      headers: { 'content-length': String(bundle.byteLength) },
      body: bundle,
    })
  })

  await page.goto(`/#/bridge-import?port=54321&token=${token}`)

  await expect(page).toHaveURL(/#editor\/.+/)
  await expect(page.getByText('2 个面板')).toBeVisible()
  await expect.poll(() => completed).toBe(true)
})

test('six-panel workflow exports a PNG without external requests', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.hostname !== '127.0.0.1' && url.protocol !== 'blob:') {
      externalRequests.push(request.url())
    }
  })

  await createProject(page)
  await page.getByTestId('image-input').setInputFiles(imageFiles(6))
  await expect(page.getByText('6 \u4e2a\u9762\u677f')).toBeVisible()
  await expect(page.getByRole('button', { name: /\u7d27\u51d1\u81ea\u9002\u5e94/ })).toBeVisible()
  await page.getByRole('button', { name: /\u7d27\u51d1\u81ea\u9002\u5e94/ }).click()

  await expect(page.locator('.workspace')).toHaveScreenshot('six-panel-workspace.png', {
    animations: 'disabled',
  })

  await openEditorSection(page, '面板标签')
  await page.locator('.field-grid label').filter({ hasText: '样式' })
    .locator('select').selectOption('lowercase')
  await page.getByRole('button', { name: '标签使用括号' }).click()
  await expect(page.locator('.figure-stage .figure-svg text').first())
    .toHaveText('(a)')
  await page.locator('.field-grid label').filter({ hasText: '字体' })
    .locator('select').selectOption('georgia')
  await page.getByRole('button', { name: '标签位置：右下角' }).click()
  await page.getByRole('button', { name: '半粗' }).click()
  await page.locator('.range-row').filter({ hasText: '水平边距' }).locator('input').fill('28')
  await page.locator('.range-row').filter({ hasText: '垂直边距' }).locator('input').fill('22')

  await openEditorSection(page, '导出')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '\u5bfc\u51fa\u9ad8\u6e05 PNG' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.png$/)
  const pngPath = await download.path()
  expect(pngPath).not.toBeNull()
  const pngBytes = await readFile(pngPath!)
  expect(pngBytes.readUInt32BE(16)).toBe(3000)

  const svgDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '\u5bfc\u51fa\u53ef\u7f16\u8f91 SVG' }).click()
  const svgDownload = await svgDownloadPromise
  const svgPath = await svgDownload.path()
  expect(svgPath).not.toBeNull()
  const svgText = await readFile(svgPath!, 'utf8')
  expect(svgText).toContain('<text')
  expect(svgText).toContain('data:image/png;base64,')
  expect(svgText).toContain('font-family="Georgia, &quot;Times New Roman&quot;, serif"')
  expect(svgText).toContain('font-weight="600"')
  expect(svgText).toContain('text-anchor="end"')
  expect(svgText).toContain('>(a)</text>')
  expect(externalRequests).toEqual([])

})

test('main figure reorders panels by dragging and supports undo', async ({ page }) => {
  await createProject(page)
  await page.getByTestId('image-input').setInputFiles(imageFiles(6))
  await expect(page.getByText('6 个面板')).toBeVisible()

  const panels = page.locator('.figure-stage .figure-panel')
  const hitboxes = page.locator('.figure-stage .panel-hitbox')
  const sourceId = await panels.first().getAttribute('data-panel-id')
  const sourceBox = await hitboxes.first().boundingBox()
  const targetBox = await hitboxes.last().boundingBox()
  expect(sourceId).not.toBeNull()
  expect(sourceBox).not.toBeNull()
  expect(targetBox).not.toBeNull()

  await page.mouse.move(
    sourceBox!.x + sourceBox!.width / 2,
    sourceBox!.y + sourceBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    targetBox!.x + targetBox!.width - 3,
    targetBox!.y + targetBox!.height / 2,
    { steps: 8 },
  )
  await expect(page.locator('.panel-drop-line')).toHaveCount(1)
  await expect(page.locator('.panel-hitbox.is-drop-target')).toHaveCount(1)
  await page.mouse.up()

  await expect.poll(async () =>
    page.locator('.asset-meta strong').allTextContents(),
  ).toEqual([
    'panel-2.png',
    'panel-3.png',
    'panel-4.png',
    'panel-5.png',
    'panel-6.png',
    'panel-1.png',
  ])
  await expect(panels.last()).toHaveAttribute('data-panel-id', sourceId!)
  await expect(panels.last().locator('text')).toHaveText('F')
  await expect(panels.last().locator('.panel-hitbox')).toHaveClass(/is-selected/)

  await page.getByTitle('撤销').click()
  await expect.poll(async () =>
    page.locator('.asset-meta strong').allTextContents(),
  ).toEqual([
    'panel-1.png',
    'panel-2.png',
    'panel-3.png',
    'panel-4.png',
    'panel-5.png',
    'panel-6.png',
  ])

  await page.getByTitle('重做').click()
  await expect(panels.last()).toHaveAttribute('data-panel-id', sourceId!)
  await page.getByTitle('撤销').click()

  const restoredSourceBox = await hitboxes.first().boundingBox()
  const canvasBox = await page.locator('.figure-stage .canvas-frame').boundingBox()
  expect(restoredSourceBox).not.toBeNull()
  expect(canvasBox).not.toBeNull()
  await page.mouse.move(
    restoredSourceBox!.x + restoredSourceBox!.width / 2,
    restoredSourceBox!.y + restoredSourceBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(canvasBox!.x - 10, canvasBox!.y - 10, { steps: 6 })
  await page.mouse.up()
  await expect(page.locator('.asset-meta strong').first()).toHaveText('panel-1.png')
})

test('nine-panel workflow keeps three candidates and stable visuals', async ({ page }) => {
  await createProject(page)
  await page.getByTestId('image-input').setInputFiles(imageFiles(9))
  await expect(page.getByText('9 \u4e2a\u9762\u677f')).toBeVisible()
  await expect(page.locator('.candidate-card')).toHaveCount(3)
  await expect(page.locator('.workspace')).toHaveScreenshot('nine-panel-workspace.png', {
    animations: 'disabled',
  })
})

test('editor sections stay reachable in a short desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await createProject(page)
  await page.getByTestId('image-input').setInputFiles(imageFiles(6))
  await expect(page.getByText('6 个面板')).toBeVisible()

  const workspace = page.locator('.workspace')
  const workspaceBox = await workspace.boundingBox()
  expect(workspaceBox).not.toBeNull()
  expect(workspaceBox!.y + workspaceBox!.height).toBeLessThanOrEqual(720)

  for (const selector of ['.asset-sidebar', '.canvas-column', '.inspector-sidebar']) {
    const box = await page.locator(selector).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeLessThanOrEqual(workspaceBox!.height)
  }

  const toggles = page.locator('.collapsible-trigger')
  await expect(toggles).toHaveCount(8)
  await expect(toggles.filter({ hasText: '画布' }))
    .toHaveAttribute('aria-expanded', 'false')
  await expect(toggles.filter({ hasText: 'Figure 预览' }))
    .toHaveAttribute('aria-expanded', 'true')

  const previewToggle = toggles.filter({ hasText: 'Figure 预览' })
  await previewToggle.click()
  await expect(page.locator('.figure-stage .canvas-frame')).toBeHidden()
  await previewToggle.click()
  await expect(page.locator('.figure-stage .canvas-frame')).toBeVisible()

  for (const section of ['画布', '面板标签', '导出', '文件夹备份']) {
    await openEditorSection(page, section)
  }

  const inspectorMetrics = await page.locator('.inspector-sidebar').evaluate(
    (element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }),
  )
  expect(inspectorMetrics.scrollHeight).toBeGreaterThan(inspectorMetrics.clientHeight)
  await page.locator('.inspector-sidebar').evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(page.getByRole('button', { name: /通用设置/ })).toBeVisible()

  await page.reload()
  await expect(page.locator('.collapsible-trigger').filter({ hasText: '导出' }))
    .toHaveAttribute('aria-expanded', 'true')
})

test('unsupported files show a clear validation error', async ({ page }) => {
  await createProject(page)
  await page.getByTestId('image-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  })
  await expect(page.locator('.notice-error')).toContainText('\u4e0d\u652f\u6301\u8be5\u683c\u5f0f')
})

test('folder backup writes immediately and again after two idle seconds', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & {
      __backupWriteCount: number
      __latestBackupSize: number
      __latestBackup: Blob | null
    }
    state.__backupWriteCount = 0
    state.__latestBackupSize = 0
    state.__latestBackup = null

    class MockFileHandle {
      readonly kind = 'file'
      constructor(
        readonly name: string,
        private readonly directory: MockDirectoryHandle,
      ) {}

      async createWritable() {
        let pending: Blob | null = null
        return {
          write: async (data: Blob) => {
            pending = data
          },
          close: async () => {
            if (!pending) return
            this.directory.files.set(this.name, pending)
            state.__backupWriteCount += 1
            if (this.name === 'latest.figgrid') {
              state.__latestBackupSize = pending.size
              state.__latestBackup = pending
            }
          },
          abort: async () => {
            pending = null
          },
        }
      }
    }

    class MockDirectoryHandle {
      readonly kind = 'directory'
      readonly files = new Map<string, Blob>()
      readonly directories = new Map<string, MockDirectoryHandle>()

      constructor(readonly name: string) {}

      async queryPermission() {
        return 'granted' as const
      }

      async requestPermission() {
        return 'granted' as const
      }

      async getFileHandle(name: string) {
        return new MockFileHandle(name, this)
      }

      async getDirectoryHandle(name: string) {
        let directory = this.directories.get(name)
        if (!directory) {
          directory = new MockDirectoryHandle(name)
          this.directories.set(name, directory)
        }
        return directory
      }

      async removeEntry(name: string) {
        this.files.delete(name)
      }

      async *entries() {
        for (const name of this.files.keys()) {
          yield [name, new MockFileHandle(name, this)] as const
        }
      }
    }

    const root = new MockDirectoryHandle('论文备份')
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => root,
    })
  })

  await page.goto('/#settings')
  await page.getByRole('button', { name: '选择文件夹' }).click()
  await expect(page.getByText('自动备份已开启')).toBeVisible()
  const folderRow = page.locator('.settings-folder-row')
  const folderCopy = folderRow.locator('> div')
  const folderButton = folderRow.getByRole('button', { name: '更换文件夹' })
  await expect(folderCopy).toBeVisible()
  await expect(folderButton).toBeVisible()
  expect((await folderCopy.boundingBox())!.width).toBeGreaterThan(300)
  expect((await folderButton.boundingBox())!.width).toBeLessThan(180)
  expect((await folderRow.boundingBox())!.height).toBeLessThan(120)
  await expect(page.locator('.settings-card')).toHaveScreenshot(
    'general-settings-configured.png',
    { animations: 'disabled' },
  )
  await page.getByRole('button', { name: '我的工程' }).click()
  await page.locator('.new-project-card').click()
  await page.getByTestId('image-input').setInputFiles(imageFiles(2))
  await expect(page.getByText('已备份', { exact: true })).toBeVisible()

  const firstWriteCount = await page.evaluate(() =>
    (window as Window & { __backupWriteCount: number }).__backupWriteCount,
  )
  expect(firstWriteCount).toBe(2)

  await openEditorSection(page, '面板标签')
  await page.getByRole('button', { name: '标签位置：左下角' }).click()
  await expect(page.getByText('等待备份', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __backupWriteCount: number }).__backupWriteCount,
  )).toBe(3)
  expect(await page.evaluate(() =>
    (window as Window & { __latestBackupSize: number }).__latestBackupSize,
  )).toBeGreaterThan(0)

  const latestBytes = await page.evaluate(async () => {
    const latest = (window as Window & { __latestBackup: Blob | null })
      .__latestBackup
    if (!latest) return []
    return Array.from(new Uint8Array(await latest.arrayBuffer()))
  })
  const previousUrl = page.url()
  await page.getByRole('button', { name: '我的工程', exact: true }).click()
  await page.locator('.projects-header-actions input[accept*=".figgrid"]').setInputFiles({
    name: 'folder-backup.figgrid',
    mimeType: 'application/x-figgrid',
    buffer: Buffer.from(latestBytes),
  })
  await expect(page).toHaveURL(/#editor\/.+/)
  expect(page.url()).not.toBe(previousUrl)
  await expect(page.getByRole('button', { name: '标签位置：左下角' }))
    .toHaveClass(/is-active/)
})

test('project center manages saved projects and real thumbnails', async ({ page }) => {
  await createProject(page)
  await page.getByLabel('工程名称').fill('细胞实验 Figure')
  await page.getByTestId('image-input').setInputFiles(imageFiles(2))
  await expect(page.getByText('2 个面板')).toBeVisible()
  await page.getByRole('button', { name: '我的工程', exact: true }).click()

  await expect(page.getByRole('heading', { name: '细胞实验 Figure' })).toBeVisible()
  await expect(page.locator('.project-card .project-thumbnail img')).toBeVisible()

  const originalCard = page.locator('.project-card').filter({
    hasText: '细胞实验 Figure',
  })
  await originalCard.getByRole('button', { name: '重命名' }).click()
  await page.getByLabel('新工程名称').fill('投稿 Figure 1')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('heading', { name: '投稿 Figure 1' })).toBeVisible()

  await page.getByRole('button', { name: '复制' }).click()
  await expect(page.locator('.project-card')).toHaveCount(2)
  const duplicateCard = page.locator('.project-card').filter({ hasText: '副本' })
  await expect(duplicateCard).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await duplicateCard.getByRole('button', { name: '删除' }).click()
  await expect(page.locator('.project-card')).toHaveCount(1)

  await page.reload()
  await expect(page.getByRole('heading', { name: '投稿 Figure 1' })).toBeVisible()
})

test('general settings explain unavailable folder access', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: undefined,
    })
  })
  await page.goto('/#settings')

  await expect(page.getByRole('heading', { name: '通用设置' })).toBeVisible()
  await expect(page.getByText('需要 HTTPS 和最新版 Chrome / Edge')).toBeVisible()
  expect(await page.locator('.settings-card-heading h2').evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  )).toBeGreaterThanOrEqual(18)
  expect(await page.locator('.settings-notes').evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  )).toBeGreaterThanOrEqual(11)
  await expect(page.locator('.dashboard-shell')).toHaveScreenshot('general-settings.png', {
    animations: 'disabled',
  })
})
