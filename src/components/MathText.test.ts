import { describe, expect, it } from 'vitest'
import { isLikelyMathExpression, normalizeMathSource, splitMathText } from './MathText'
import { parsePipeTable, splitEquationLines } from './MathContent'

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

  it('supports Gemini single-dollar inline and display math', () => {
    expect(splitMathText('The function $f(x)=mx+b$ is linear.')).toEqual([
      { kind: 'text', value: 'The function ' },
      { kind: 'formula', value: 'f(x)=mx+b', display: false },
      { kind: 'text', value: ' is linear.' },
    ])
    expect(splitMathText('Solve: $$m = \\frac{y_2-y_1}{x_2-x_1}$$')).toEqual([
      { kind: 'text', value: 'Solve: ' },
      { kind: 'formula', value: 'm = \\frac{y_2-y_1}{x_2-x_1}', display: true },
    ])
  })

  it('normalizes bare powers and unicode superscripts for KaTeX', () => {
    expect(normalizeMathSource('x^2 y^(5/2) 3x²y⁴ P₀')).toBe('x^{2} y^{\\frac{5}{2}} 3x^{2}y^{4} P_{0}')
    expect(normalizeMathSource('x/(x + 1) + 4/(x - 2)')).toBe('\\frac{x}{(x + 1)} + \\frac{4}{(x - 2)}')
  })

  it('does not send prose answer choices through the math renderer', () => {
    expect(isLikelyMathExpression('All registered voters in the city')).toBe(false)
    expect(isLikelyMathExpression('x/(x + 1) + 4/(x - 2)')).toBe(true)
  })

  it('recovers pipe-delimited tables and keeps surrounding question text', () => {
    const parsed = parsePipeTable('The table below shows scores: Score | Frequency\n6 | 3\n7 | 5 What is the median score?')
    expect(parsed?.before).toBe('The table below shows scores:')
    expect(parsed?.table.headers).toEqual(['Score', 'Frequency'])
    expect(parsed?.table.rows).toEqual([['6', '3'], ['7', '5']])
    expect(parsed?.after).toBe('What is the median score?')
  })

  it('puts a system of equations on separate lines before the question', () => {
    expect(splitEquationLines('Consider the system of equations below:\n3x + 2y = 19\nx - 2y = 5 What is the value of x + y?')).toEqual([
      'Consider the system of equations below:',
      '3x + 2y = 19',
      'x - 2y = 5',
      'What is the value of x + y?',
    ])
  })
})
