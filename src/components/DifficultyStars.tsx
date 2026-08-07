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
