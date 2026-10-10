import { useCallback, useEffect, useState } from 'react'

export const EDITOR_SECTION_IDS = [
  'assets',
  'layouts',
  'preview',
  'panel',
  'canvas',
  'labels',
  'export',
  'backup',
] as const

export type EditorSectionId = (typeof EDITOR_SECTION_IDS)[number]
export type EditorSectionState = Record<EditorSectionId, boolean>

export const EDITOR_SECTION_STORAGE_KEY =
  'layout-assistant:editor-sections:v1'

export const DEFAULT_EDITOR_SECTIONS: EditorSectionState = {
  assets: true,
  layouts: true,
  preview: true,
  panel: true,
  canvas: false,
  labels: false,
  export: false,
  backup: false,
}

export function readEditorSections(): EditorSectionState {
  try {
    const stored = window.localStorage.getItem(EDITOR_SECTION_STORAGE_KEY)
    if (!stored) return { ...DEFAULT_EDITOR_SECTIONS }
    const parsed: unknown = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_EDITOR_SECTIONS }
    }

    const next = { ...DEFAULT_EDITOR_SECTIONS }
    for (const id of EDITOR_SECTION_IDS) {
      const value = (parsed as Record<string, unknown>)[id]
      if (typeof value === 'boolean') next[id] = value
    }
    return next
  } catch {
    return { ...DEFAULT_EDITOR_SECTIONS }
  }
}

export function useEditorSections() {
  const [sections, setSections] = useState<EditorSectionState>(readEditorSections)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        EDITOR_SECTION_STORAGE_KEY,
        JSON.stringify(sections),
      )
    } catch {
      // Storage can be unavailable in private or locked-down browser contexts.
    }
  }, [sections])

  const toggleSection = useCallback((id: EditorSectionId) => {
    setSections((current) => ({ ...current, [id]: !current[id] }))
  }, [])

  return { sections, toggleSection }
}
