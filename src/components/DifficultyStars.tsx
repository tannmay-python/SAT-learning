import { Star } from '@phosphor-icons/react'
import type { Difficulty } from '../types'

const labels: Record<Difficulty, string> = {
  1: 'Warm-up',
  2: 'Straightforward',
  3: 'Test-level',
  4: 'Hard',
  5: 'Hardest',
}

/**
 * A bare "Difficulty 3" says nothing about what the number means. Five stars
 * read at a glance, and the word alongside them tells the learner where the
 * item sits relative to the real test.
 */
export function DifficultyStars({ difficulty, showLabel = true, size = 12 }: { difficulty: Difficulty; showLabel?: boolean; size?: number }) {
  return (
    <span className="difficulty-stars" title={`${labels[difficulty]} — ${difficulty} of 5`} aria-label={`Difficulty ${difficulty} of 5, ${labels[difficulty]}`}>
      <span aria-hidden="true">
        {([1, 2, 3, 4, 5] as const).map((step) => (
          <Star key={step} size={size} weight={step <= difficulty ? 'fill' : 'regular'} className={step <= difficulty ? 'filled' : ''} />
        ))}
      </span>
      {showLabel && <em>{labels[difficulty]}</em>}
    </span>
  )
}

export const difficultyLabel = (difficulty: Difficulty) => labels[difficulty]

/**
 * Lets the learner pin a practice set to one difficulty instead of letting the
 * calibrated target decide. "Adaptive" (the default) hands the target back to
 * `sectionTargetDifficulty`; picking a star fixes every question in that
 * section to that level regardless of recent evidence.
 */
export function DifficultyScalePicker({ value, onChange }: { value: Difficulty | 'adaptive'; onChange: (value: Difficulty | 'adaptive') => void }) {
  return (
    <div className="difficulty-scale-picker">
      <button type="button" className={value === 'adaptive' ? 'active' : ''} onClick={() => onChange('adaptive')}>Adaptive</button>
      {([1, 2, 3, 4, 5] as const).map((step) => (
        <button
          type="button"
          key={step}
          className={value === step ? 'active' : ''}
          title={`${labels[step]} — ${step} of 5`}
          aria-label={`Fix difficulty at ${step} of 5, ${labels[step]}`}
          aria-pressed={value === step}
          onClick={() => onChange(step)}
        >
          <Star size={13} weight={typeof value === 'number' && step <= value ? 'fill' : 'regular'} />
        </button>
      ))}
      <em>{value === 'adaptive' ? 'Follows your calibration' : labels[value]}</em>
    </div>
  )
}
