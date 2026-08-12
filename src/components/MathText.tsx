import type { ReactNode } from 'react'
import katex from 'katex'

export type MathTextToken =
  | { kind: 'text'; value: string }
  | { kind: 'formula'; value: string; display: boolean }

const MATH_DELIMITERS = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g
const BARE_MATH = /\\frac\{([^{}]+)\}\{([^{}]+)\}|\\sqrt\{([^{}]+)\}|([A-Za-z0-9)])\^\(([^()\n]+)\)|([A-Za-z0-9)])\^\{([^{}\n]+)\}|([A-Za-z0-9)])\^([+-]?\d+(?:\/\d+)?|[A-Za-z])|([A-Za-z0-9])([⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺⁽⁾ⁿ]+)/g
const SUPERSCRIPT_MAP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+', '⁽': '(', '⁾': ')', ⁿ: 'n' }

function looksLikeMath(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  // Gemini sometimes uses single-dollar delimiters for ordinary variables,
  // functions, fractions, and equations. Keep plain currency such as "$5"
  // or "$5 and the fee is $8" as prose.
  return /\\[a-zA-Z]+|[=+*/^_]|(?:\s-\s|^-\s*\d)|[A-Za-z]\s*\([^)]*\)|\([^)]*\)|^[A-Za-z]{1,4}$/.test(trimmed)
}

export function normalizeMathSource(value: string): string {
  return value
    .replace(/([A-Za-z0-9)])\^\(([^()\n]+)\)/g, '$1^{$2}')
    .replace(/([A-Za-z0-9)])\^\{([^{}\n]+)\}/g, '$1^{$2}')
    .replace(/([A-Za-z0-9)])\^([+-]?\d+(?:\/\d+)?|[A-Za-z])/g, '$1^{$2}')
    .replace(/([A-Za-z0-9])([⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺⁽⁾ⁿ]+)/g, (_match, base: string, exponent: string) => `${base}^{${[...exponent].map((character) => SUPERSCRIPT_MAP[character] ?? character).join('')}}`)
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
  return katex.renderToString(normalizeMathSource(value.trim()), {
    displayMode: display,
    output: 'htmlAndMathml',
    throwOnError: false,
    strict: 'ignore',
    trust: false,
  })
}

function renderBareText(value: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  const symbolText = value
    .replace(/\\leq?/g, '≤')
    .replace(/\\geq?/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\pm/g, '±')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
  for (const match of symbolText.matchAll(BARE_MATH)) {
    const index = match.index ?? 0
    if (index > lastIndex) nodes.push(<span key={`${keyPrefix}-text-${lastIndex}`}>{symbolText.slice(lastIndex, index)}</span>)
    const fraction = match[1] !== undefined
    const squareRoot = match[3] !== undefined
    const base = match[4] ?? match[6] ?? match[8] ?? match[10]
    const exponent = match[5] ?? match[7] ?? match[9] ?? [...(match[11] ?? '')].map((character) => SUPERSCRIPT_MAP[character] ?? character).join('')
    if (fraction || squareRoot) {
      const source = fraction ? `\\frac{${match[1]}}{${match[2]}}` : `\\sqrt{${match[3]}}`
      try {
        nodes.push(<span key={`${keyPrefix}-formula-${index}`} className="math-formula" dangerouslySetInnerHTML={{ __html: renderFormula(source, false) }} />)
      } catch {
        nodes.push(<span key={`${keyPrefix}-fallback-${index}`}>{match[0]}</span>)
      }
    } else {
      nodes.push(<span key={`${keyPrefix}-power-${index}`}>{base}<sup>{exponent}</sup></span>)
    }
    lastIndex = index + match[0].length
  }
  if (lastIndex < symbolText.length) nodes.push(<span key={`${keyPrefix}-text-${lastIndex}`}>{symbolText.slice(lastIndex)}</span>)
  return nodes.length ? nodes : [<span key={`${keyPrefix}-text-0`}>{symbolText}</span>]
}

interface Props {
  text?: string
  className?: string
  mathOnly?: boolean
}

export function MathText({ text = '', className = '', mathOnly = false }: Props): ReactNode {
  if (mathOnly) {
    try {
      return <span className={`math-text math-only ${className}`.trim()} dangerouslySetInnerHTML={{ __html: renderFormula(text, false) }} />
    } catch {
      return <span className={`math-text ${className}`.trim()}>{renderBareText(text, 'math-only-fallback')}</span>
    }
  }
  return (
    <span className={`math-text ${className}`.trim()}>
      {text.split('\n').map((line, lineIndex) => <span className="math-text-line" key={lineIndex}>{lineIndex > 0 && <br />}{splitMathText(line).map((token, index) => token.kind === 'text' ? renderBareText(token.value, `${lineIndex}-${index}`) : (() => {
        try {
          return <span key={`${lineIndex}-formula-${index}`} className={token.display ? 'math-formula math-formula-display' : 'math-formula'} dangerouslySetInnerHTML={{ __html: renderFormula(token.value, token.display) }} />
        } catch {
          return <span key={`${lineIndex}-fallback-${index}`} className="math-formula-fallback">{token.value}</span>
        }
      })())}</span>)}
    </span>
  )
}
