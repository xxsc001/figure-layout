import './test/setup'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDB } from 'idb'
import App from './App'
import { createEmptyProject } from './lib/project'
import { clearBackupPreferences, saveProject } from './lib/storage'
import { EDITOR_SECTION_STORAGE_KEY } from './hooks/useEditorSections'

async function resetDatabase() {
  const database = await openDB('layout-assistant', 3, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects')
      if (!db.objectStoreNames.contains('project-summaries')) {
        db.createObjectStore('project-summaries')
      }
      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences')
      }
    },
  })
  const transaction = database.transaction(
    ['projects', 'project-summaries', 'preferences'],
    'readwrite',
  )
  await Promise.all([
    transaction.objectStore('projects').clear(),
    transaction.objectStore('project-summaries').clear(),
    transaction.objectStore('preferences').clear(),
  ])
  await transaction.done
  database.close()
  await clearBackupPreferences()
}

describe('论文图片排版助手', () => {
  beforeEach(async () => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
    await resetDatabase()
  })

  afterEach(() => {
    cleanup()
  })

  it('opens the project center from the landing page and creates a project', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: /让科研排图/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /立即开始/ }))
    expect(await screen.findByRole('heading', { name: '我的工程' })).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /新建工程/ }).at(-1)!)
    expect(await screen.findByTestId('image-input')).toBeInTheDocument()
  })

  it('loads a specific project and presents three layout candidates', async () => {
    const user = userEvent.setup()
    const project = createEmptyProject()
    await saveProject(project)
    window.history.replaceState(null, '', `/#editor/${project.id}`)
    render(<App />)
    const input = await screen.findByTestId('image-input')
    const files = Array.from(
      { length: 6 },
      (_, index) =>
        new File([`image-${index}`], `panel-${index}.png`, { type: 'image/png' }),
    )

    await user.upload(input, files)

    await waitFor(() => {
      expect(screen.getAllByText('经典网格')).toHaveLength(2)
      expect(screen.getByText('紧凑自适应')).toBeInTheDocument()
      expect(screen.getByText('均衡布局')).toBeInTheDocument()
    })
    expect(screen.getAllByTestId('figure-canvas')).toHaveLength(4)
    expect(screen.getByText('6 个面板')).toBeInTheDocument()
  })

  it('collapses editor sections independently and restores the preference', async () => {
    const user = userEvent.setup()
    const project = createEmptyProject()
    await saveProject(project)
    window.history.replaceState(null, '', `/#editor/${project.id}`)
    const view = render(<App />)
    const input = await screen.findByTestId('image-input')
    const files = Array.from(
      { length: 2 },
      (_, index) =>
        new File([`image-${index}`], `panel-${index}.png`, { type: 'image/png' }),
    )
    await user.upload(input, files)

    const expected = [
      ['图片面板', 'true'],
      ['选择一个布局起点', 'true'],
      ['Figure 预览', 'true'],
      ['当前面板', 'true'],
      ['画布', 'false'],
      ['面板标签', 'false'],
      ['导出', 'false'],
      ['文件夹备份', 'false'],
    ] as const

    expected.forEach(([name, expanded]) => {
      expect(screen.getByRole('button', { name: new RegExp(name) }))
        .toHaveAttribute('aria-expanded', expanded)
    })

    const canvasToggle = screen.getByRole('button', { name: /画布/ })
    canvasToggle.focus()
    await user.keyboard('{Enter}')
    expect(canvasToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('图片间距')).toBeVisible()

    const labelsToggle = screen.getByRole('button', { name: /面板标签/ })
    await user.click(labelsToggle)
    expect(labelsToggle).toHaveAttribute('aria-expanded', 'true')

    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(EDITOR_SECTION_STORAGE_KEY) ?? '{}',
      ) as Record<string, unknown>
      expect(stored.canvas).toBe(true)
      expect(stored.labels).toBe(true)
    })

    view.unmount()
    render(<App />)
    expect(await screen.findByRole('button', { name: /画布/ }))
      .toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /面板标签/ }))
      .toHaveAttribute('aria-expanded', 'true')
  })

  it('switches from project center to general settings', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/#projects')
    render(<App />)
    await screen.findByRole('heading', { name: '我的工程' })

    await user.click(screen.getAllByRole('button', { name: '通用设置' })[0])

    expect(await screen.findByRole('heading', { name: '通用设置' })).toBeInTheDocument()
    expect(screen.getByText('自动备份文件夹')).toBeInTheDocument()
  })

  it('shows a manual fallback for an invalid Origin bridge link', async () => {
    window.history.replaceState(
      null,
      '',
      '/#/bridge-import?port=80&token=short',
    )

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '自动导入没有完成' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Origin 助手端口无效。')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '手动导入 selected.figgrid' }),
    ).toBeInTheDocument()
  })
})
