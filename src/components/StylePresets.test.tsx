import '../test/setup'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StylePresets } from './StylePresets'
import { createEmptyProject } from '../lib/project'
import { readStylePresets } from '../lib/style-presets'

beforeEach(() => localStorage.clear())
afterEach(cleanup)
it('saves, restores, applies, updates and deletes a common style', async () => {
  const user = userEvent.setup()
  const project = createEmptyProject()
  project.style.labelOffsetX = -20
  const apply = vi.fn()
  const view = render(<StylePresets project={project} onApply={apply} />)
  await user.type(screen.getByRole('textbox', { name: '样式名称' }), '论文格式')
  await user.click(screen.getByRole('button', { name: '保存当前格式为常用样式' }))
  expect(readStylePresets()).toHaveLength(1)
  view.unmount()
  render(<StylePresets project={project} onApply={apply} />)
  await user.selectOptions(screen.getByRole('combobox', { name: '已保存的样式' }), readStylePresets()[0].id)
  await user.click(screen.getByRole('button', { name: '应用样式' }))
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ style: expect.objectContaining({ labelOffsetX: -20 }) }))
  project.style.labelOffsetX = -30
  await user.click(screen.getByRole('button', { name: '更新样式' }))
  expect(readStylePresets()[0].style.labelOffsetX).toBe(-30)
  await user.click(screen.getByRole('button', { name: '删除样式' }))
  expect(readStylePresets()).toEqual([])
})
