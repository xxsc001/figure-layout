import '../test/setup'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../lib/project'
import { useProjectHistory } from './useProjectHistory'

describe('project history', () => {
  it('does not create an undo entry for an identity update', () => {
    const { result } = renderHook(() => useProjectHistory(createEmptyProject()))

    act(() => result.current.commit((project) => project))

    expect(result.current.canUndo).toBe(false)
  })
})
