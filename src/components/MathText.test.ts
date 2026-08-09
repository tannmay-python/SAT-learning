import { describe, expect, it } from 'vitest'
import { splitMathText } from './MathText'

describe('splitMathText', () => {
  it('separates inline and display LaTeX from surrounding prose', () => {
    expect(splitMathText('The function \\(f(x)=cx+d\\) is linear.')).toEqual([
      { kind: 'text', value: 'The function ' },
      { kind: 'formula', value: 'f(x)=cx+d', display: false },
      { kind: 'text', value: ' is linear.' },
    ])
    expect(splitMathText('Solve: \\[x^2=9\\]')).toEqual([
      { kind: 'text', value: 'Solve: ' },
      { kind: 'formula', value: 'x^2=9', display: true },
    ])
  })

  it('does not mistake currency for math delimiters', () => {
    expect(splitMathText('The ticket costs $5 and the fee is $8.')).toEqual([
      { kind: 'text', value: 'The ticket costs $5 and the fee is $8.' },
    ])
  })
})
