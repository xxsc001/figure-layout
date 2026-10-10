import '../test/setup'
import { beforeEach, expect, it } from 'vitest'
import { addProjectFolder, assignProjectFolder, readProjectFolders, removeProjectFolder, writeProjectFolders } from './project-folders'
beforeEach(() => localStorage.clear())
it('saves folders and project membership across reloads', () => {
  const created = addProjectFolder(readProjectFolders(), '论文')
  const moved = assignProjectFolder(created, 'project-a', created.folders[0].id)
  writeProjectFolders(moved)
  expect(readProjectFolders()).toEqual(moved)
  expect(assignProjectFolder(moved, 'project-a', '').assignments).toEqual({})
})
it('deleting a folder releases projects without changing other folders', () => {
  const first = addProjectFolder(readProjectFolders(), '论文')
  const second = addProjectFolder(first, '实验')
  const assigned = assignProjectFolder(second, 'a', first.folders[0].id)
  const result = removeProjectFolder(assigned, first.folders[0].id)
  expect(result.folders).toEqual([second.folders[1]])
  expect(result.assignments).toEqual({})
})
it('rejects empty or duplicate names and nonexistent destinations', () => {
  const created = addProjectFolder(readProjectFolders(), '论文')
  expect(() => addProjectFolder(created, ' ')).toThrow()
  expect(() => addProjectFolder(created, ' 论文 ')).toThrow()
  expect(() => assignProjectFolder(created, 'a', 'missing')).toThrow()
})
