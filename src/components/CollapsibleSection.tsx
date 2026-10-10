import type { ReactNode } from 'react'
import type { EditorSectionId } from '../hooks/useEditorSections'

interface CollapsibleSectionProps {
  sectionId: EditorSectionId
  title: string
  eyebrow?: string
  summary?: ReactNode
  headingLevel?: 2 | 3
  open: boolean
  className?: string
  onToggle: (sectionId: EditorSectionId) => void
  children: ReactNode
}

export function CollapsibleSection({
  sectionId,
  title,
  eyebrow,
  summary,
  headingLevel = 2,
  open,
  className = '',
  onToggle,
  children,
}: CollapsibleSectionProps) {
  const headingId = `editor-section-${sectionId}-heading`
  const contentId = `editor-section-${sectionId}-content`
  const classes = [
    'collapsible-section',
    open ? 'is-open' : 'is-collapsed',
    className,
  ].filter(Boolean).join(' ')

  return (
    <section className={classes} aria-labelledby={headingId}>
      <button
        type="button"
        className="collapsible-trigger"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => onToggle(sectionId)}
      >
        <span className="collapsible-heading-copy">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          {headingLevel === 2 ? (
            <h2 id={headingId}>{title}</h2>
          ) : (
            <h3 id={headingId}>{title}</h3>
          )}
        </span>
        <span className="collapsible-trailing">
          {summary && <span className="collapsible-summary">{summary}</span>}
          <span className="collapsible-chevron" aria-hidden="true">›</span>
        </span>
      </button>
      <div
        id={contentId}
        className="collapsible-content"
        hidden={!open}
      >
        {children}
      </div>
    </section>
  )
}
