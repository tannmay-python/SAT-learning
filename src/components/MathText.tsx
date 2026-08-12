import type { ReactNode } from 'react'
import katex from 'katex'

export type MathTextToken =
  | { kind: 'text'; value: string }
  | { kind: 'formula'; value: string; display: boolean }

const MATH_DELIMITERS = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g

function looksLikeMath(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  // Gemini sometimes uses single-dollar delimiters for ordinary variables,
  // functions, fractions, and equations. Keep plain currency such as "$5"
  // or "$5 and the fee is $8" as prose.
  return /\\[a-zA-Z]+|[=+*/^_]|(?:\s-\s|^-\s*\d)|[A-Za-z]\s*\([^)]*\)|\([^)]*\)|^[A-Za-z]{1,4}$/.test(trimmed)
}

/**
 * Split mixed prose and the delimiters used by Gemini into safe renderable
 * pieces. Dollar delimiters are intentionally excluded: SAT questions often
 * contain currency such as "$5" and "$8", which can be mistaken for math.
 */
export function splitMathText(text: string): MathTextToken[] {
  const tokens: MathTextToken[] = []
  let lastIndex = 0
  const pushText = (value: string) => {
    if (!value) return
    const previous = tokens[tokens.length - 1]
    if (previous?.kind === 'text') previous.value += value
    else tokens.push({ kind: 'text', value })
  }

  for (const match of text.matchAll(MATH_DELIMITERS)) {
    const index = match.index ?? 0
    if (index > lastIndex) pushText(text.slice(lastIndex, index))
    const isSingleDollar = match[4] !== undefined
    if (isSingleDollar && !looksLikeMath(match[4])) {
      pushText(match[0])
      lastIndex = index + match[0].length
      continue
    }
    tokens.push({
      kind: 'formula',
      value: match[1] ?? match[2] ?? match[3] ?? match[4] ?? '',
      display: Boolean(match[1] || match[3]),
    })
    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) pushText(text.slice(lastIndex))
  return tokens.length ? tokens : [{ kind: 'text', value: text }]
}

function renderFormula(value: string, display: boolean): string {
  return katex.renderToString(value.trim(), {
    displayMode: display,
    output: 'htmlAndMathml',
    throwOnError: false,
    strict: 'ignore',
    trust: false,
  })
}

interface Props {
  text: string
  className?: string
}

export function MathText({ text, className = '' }: Props): ReactNode {
  return (
    <span className={`math-text ${className}`.trim()}>
      {splitMathText(text).map((token, index) => {
        if (token.kind === 'text') return <span key={index}>{token.value}</span>
        try {
          return <span key={index} className={token.display ? 'math-formula math-formula-display' : 'math-formula'} dangerouslySetInnerHTML={{ __html: renderFormula(token.value, token.display) }} />
        } catch {
          return <span key={index} className="math-formula-fallback">{token.value}</span>
        }
      })}
    </span>
  )
}
