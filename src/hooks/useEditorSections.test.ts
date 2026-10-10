import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_EDITOR_SECTIONS,
  EDITOR_SECTION_STORAGE_KEY,
  readEditorSections,
} from './useEditorSections'

describe('editor section preferences', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('uses the core-first default state', () => {
    expect(readEditorSections()).toEqual(DEFAULT_EDITOR_SECTIONS)
  })

  it('merges valid stored booleans with defaults', () => {
    window.localStorage.setItem(
      EDITOR_SECTION_STORAGE_KEY,
      JSON.stringify({ canvas: true, preview: false, export: 'yes' }),
    )

    expect(readEditorSections()).toEqual({
      ...DEFAULT_EDITOR_SECTIONS,
      canvas: true,
      preview: false,
    })
  })

  it('falls back safely when stored data is damaged', () => {
    window.localStorage.setItem(EDITOR_SECTION_STORAGE_KEY, '{not-json')
    expect(readEditorSections()).toEqual(DEFAULT_EDITOR_SECTIONS)
  })
})
