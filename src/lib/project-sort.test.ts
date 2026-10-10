import { expect, it } from 'vitest'
import { sortFolders, sortProjects } from './project-sort'
import type { ProjectSummary } from '../types'
const projects = [{ id: 'a', title: 'Figure 10', updatedAt: '2026-10-09T10:00:00Z' }, { id: 'b', title: 'Figure 2', updatedAt: '2026-10-08T10:00:00Z' }] as ProjectSummary[]
it('sorts newest first by default and names using natural numeric order', () => {
  expect(sortProjects(projects, 'updated').map((p) => p.id)).toEqual(['a', 'b'])
  expect(sortProjects(projects, 'name').map((p) => p.id)).toEqual(['b', 'a'])
  expect(projects[0].id).toBe('a')
})
it('orders folders by their latest project update or by name', () => {
  const data = { folders: [{ id: 'f1', name: 'Folder 10' }, { id: 'f2', name: 'Folder 2' }], assignments: { a: 'f1', b: 'f2' } }
  expect(sortFolders(data, projects, 'updated').map((f) => f.id)).toEqual(['f1', 'f2'])
  expect(sortFolders(data, projects, 'name').map((f) => f.id)).toEqual(['f2', 'f1'])
})
