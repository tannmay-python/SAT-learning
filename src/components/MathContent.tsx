import type { DataTable } from '../types'
import { MathText } from './MathText'

interface ParsedTableContent {
  before: string
  table: DataTable
  after: string
}

function cells(line: string): string[] {
  return line.split('|').map((cell) => cell.trim()).filter(Boolean)
}

function isAlignmentRow(row: string[]): boolean {
  return row.length > 0 && row.every((cell) => /^:?-{2,}:?$/.test(cell))
}

function splitTrailingText(value: string): { cell: string; trailing: string } {
  const match = value.match(/^([-+]?\d+(?:\.\d+)?)(\s+[A-Z?].*)$/)
  return match ? { cell: match[1], trailing: match[2].trim() } : { cell: value, trailing: '' }
}

/** Recover a table when Gemini put pipe-delimited rows in prose instead of the table field. */
export function parsePipeTable(text: string): ParsedTableContent | undefined {
  const lines = text.split('\n')
  const headerIndex = lines.findIndex((line, index) => line.includes('|') && cells(line).length >= 2 && lines.slice(index + 1).some((next) => cells(next).length >= 2))
  if (headerIndex < 0) return undefined

  const headerLine = lines[headerIndex]
  const firstPipe = headerLine.indexOf('|')
  const prefixCandidate = headerLine.slice(0, firstPipe).trim()
  const prefixSeparator = prefixCandidate.lastIndexOf(':')
  const before = prefixSeparator >= 0 ? prefixCandidate.slice(0, prefixSeparator + 1).trim() : ''
  const firstHeader = prefixSeparator >= 0 ? prefixCandidate.slice(prefixSeparator + 1).trim() : prefixCandidate
  const headers = [firstHeader, ...cells(headerLine.slice(firstPipe + 1))]
  const rows: string[][] = []
  let trailing = ''
  let rowIndex = headerIndex + 1
  for (; rowIndex < lines.length; rowIndex += 1) {
    const line = lines[rowIndex]
    if (!line.includes('|')) break
    const parsed = cells(line).map((cell, index, row) => {
      if (index !== row.length - 1) return cell
      const split = splitTrailingText(cell)
      trailing = split.trailing || trailing
      return split.cell
    })
    if (parsed.length < headers.length) break
    if (!isAlignmentRow(parsed)) rows.push(parsed.slice(0, headers.length))
  }
  if (rows.length === 0) return undefined
  const after = [trailing, ...lines.slice(rowIndex).map((line) => line.trim()).filter(Boolean)].filter(Boolean).join(' ')
  return { before, table: { caption: 'Table', headers, rows }, after }
}

/** Keep equation systems visually separate from the question that follows them. */
export function splitEquationLines(text: string): string[] {
  return text.split('\n').flatMap((line) => {
    const match = line.match(/^(.+?(?:=|≤|≥|<|>)\s*[-+]?\s*[A-Za-z0-9(][^?]*?)(\s+(?:What|Which|If|For|How|In|When)\b.*)$/)
    return match ? [match[1].trim(), match[2].trim()] : [line]
  })
}

function renderMathText(text: string) {
  const lines = splitEquationLines(text)
  return <div className="math-content-text">{lines.map((line, index) => <p key={`${index}-${line}`}><MathText text={line} /></p>)}</div>
}

interface Props {
  text?: string
  className?: string
}

export function MathContent({ text = '', className = '' }: Props) {
  const parsed = parsePipeTable(text)
  if (!parsed) return <div className={`math-content ${className}`.trim()}>{renderMathText(text)}</div>
  return <div className={`math-content ${className}`.trim()}>
    {parsed.before && renderMathText(parsed.before)}
    <div className="table-wrap"><table><caption><MathText text={parsed.table.caption ?? 'Table'} /></caption><thead><tr>{(parsed.table.headers ?? []).map((header) => <th key={header}><MathText text={header} /></th>)}</tr></thead><tbody>{(parsed.table.rows ?? []).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}><MathText text={cell} /></td>)}</tr>)}</tbody></table></div>
    {parsed.after && renderMathText(parsed.after)}
  </div>
}
