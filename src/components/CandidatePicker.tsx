import type {
  FigureProjectV2,
  LayoutCandidate,
  SolvedLayout,
} from '../types'
import type { EditorSectionId } from '../hooks/useEditorSections'
import { CollapsibleSection } from './CollapsibleSection'
import { FigureCanvas } from './FigureCanvas'

interface CandidatePickerProps {
  project: FigureProjectV2
  candidates: LayoutCandidate[]
  solvedCandidates: Map<string, SolvedLayout>
  onSelect: (candidate: LayoutCandidate) => void
  sectionOpen: boolean
  onToggleSection: (sectionId: EditorSectionId) => void
}

export function CandidatePicker({
  project,
  candidates,
  solvedCandidates,
  onSelect,
  sectionOpen,
  onToggleSection,
}: CandidatePickerProps) {
  return (
    <CollapsibleSection
      sectionId="layouts"
      title="选择一个布局起点"
      eyebrow="一键排版"
      summary="所有方案都保持图片顺序"
      open={sectionOpen}
      className="candidate-section"
      onToggle={onToggleSection}
    >
      <div className="candidate-grid">
        {candidates.map((candidate) => {
          const solved = solvedCandidates.get(candidate.id)
          if (!solved) return null
          const selected = project.layoutProfile === candidate.profile
          return (
            <button
              type="button"
              className={`candidate-card${selected ? ' is-selected' : ''}`}
              onClick={() => onSelect(candidate)}
              aria-pressed={selected}
              key={candidate.id}
            >
              <div className="candidate-preview checkerboard">
                <FigureCanvas project={project} solved={solved} />
              </div>
              <span className="candidate-copy">
                <strong>{candidate.name}</strong>
                <small>{candidate.description}</small>
              </span>
              <span className="candidate-check" aria-hidden="true">
                {selected ? '✓' : ''}
              </span>
            </button>
          )
        })}
      </div>
    </CollapsibleSection>
  )
}
