import '../test/setup'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { deleteProjects, listProjectSummaries } from '../lib/storage'
import { ProjectsPage } from './ProjectsPage'
vi.mock('../lib/storage', () => ({ listProjectSummaries: vi.fn(async () => [{ id: 'one', title: '实验图', panelCount: 2, updatedAt: '2026-10-09T00:00:00Z' }]), deleteProject: vi.fn(), deleteProjects: vi.fn(), duplicateProject: vi.fn(), renameProject: vi.fn(), saveProject: vi.fn(), setLastOpenProjectId: vi.fn() }))
vi.mock('../hooks/useBackupSettings', () => ({ useBackupSettings: () => ({ supported: false }) }))
beforeEach(() => localStorage.clear())
afterEach(cleanup)
it('creates a folder, moves a project, restores it after reload and deletes its projects only after confirmation', async () => {
  const user = userEvent.setup()
  const props = { onOpenProject: vi.fn(), onOpenSettings: vi.fn() }
  const view = render(<ProjectsPage {...props} />)
  await screen.findByRole('button', { name: '打开工程：实验图' })
  await user.click(screen.getByRole('button', { name: /新建文件夹/ }))
  expect(screen.getByRole('dialog', { name: '新建文件夹' })).toBeInTheDocument()
  await user.type(screen.getByRole('textbox', { name: '文件夹名称' }), '论文')
  await user.click(screen.getByRole('button', { name: '创建文件夹' }))
  await user.selectOptions(screen.getByRole('combobox', { name: '移动工程：实验图' }), screen.getByRole('option', { name: '论文' }))
  expect(screen.queryByRole('button', { name: '打开工程：实验图' })).not.toBeInTheDocument()
  view.unmount()
  render(<ProjectsPage {...props} />)
  await user.click(await screen.findByRole('button', { name: '打开文件夹：论文' }))
  expect(await screen.findByRole('button', { name: '打开工程：实验图' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '我的工程' }))
  const confirm = vi.spyOn(window, 'confirm')
  confirm.mockReturnValueOnce(false)
  await user.click(screen.getByRole('button', { name: '删除文件夹' }))
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('确定删除文件夹'))
  expect(screen.getByRole('button', { name: '打开文件夹：论文' })).toBeInTheDocument()
  expect(deleteProjects).not.toHaveBeenCalled()
  vi.mocked(listProjectSummaries).mockResolvedValueOnce([])
  confirm.mockReturnValueOnce(true)
  await user.click(screen.getByRole('button', { name: '删除文件夹' }))
  confirm.mockRestore()
  expect(deleteProjects).toHaveBeenCalledWith(['one'])
  expect(screen.queryByRole('button', { name: '打开工程：实验图' })).not.toBeInTheDocument()
})

it('remembers the selected sorting mode and dismisses folder creation without saving', async () => {
  const user = userEvent.setup()
  const props = { onOpenProject: vi.fn(), onOpenSettings: vi.fn() }
  const view = render(<ProjectsPage {...props} />)
  await user.selectOptions(screen.getByRole('combobox', { name: '排序' }), 'name')
  await user.click(screen.getByRole('button', { name: /新建文件夹/ }))
  await user.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  view.unmount()
  render(<ProjectsPage {...props} />)
  expect(screen.getByRole('combobox', { name: '排序' })).toHaveValue('name')
})
