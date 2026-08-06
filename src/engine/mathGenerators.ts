import type { Difficulty, DomainId, Question, QuestionFormat } from '../types'
import { skillById } from '../data/curriculum'

type Rng = () => number

const mulberry32 = (seed: number): Rng => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

const int = (rng: Rng, min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min
const pick = <T,>(rng: Rng, values: T[]): T => values[int(rng, 0, values.length - 1)]
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))
const fraction = (numerator: number, denominator: number) => {
  const divisor = gcd(numerator, denominator)
  const reducedNumerator = numerator / divisor
  const reducedDenominator = denominator / divisor
  return reducedDenominator === 1 ? String(reducedNumerator) : `${reducedNumerator}/${reducedDenominator}`
}

const domainForSkill = (skillId: string): DomainId => skillById.get(skillId)?.domain ?? 'algebra'
const letters = ['A', 'B', 'C', 'D']

interface NumericInput {
  seed: number
  skillId: string
  difficulty: Difficulty
  format: QuestionFormat
  stimulus?: string
  table?: Question['table']
  plot?: Question['plot']
  prompt: string
  answer: number | string
  acceptedAnswers?: string[]
  distractors?: Array<number | string>
  distractorReasons?: Record<string, string>
  explanation: string
  concept?: string
  estimatedSeconds?: number
}

const numericQuestion = (input: NumericInput): Question => {
  const rng = mulberry32(input.seed * 97 + input.skillId.length)
  const answerText = String(input.answer)
  if (input.format === 'student-produced') {
    return {
      id: `math-${input.skillId}-${input.seed}`,
      section: 'math',
      domain: domainForSkill(input.skillId),
      skillId: input.skillId,
      difficulty: input.difficulty,
      format: input.format,
      stimulus: input.stimulus,
      table: input.table,
      plot: input.plot,
      prompt: input.prompt,
      answer: answerText,
      acceptedAnswers: input.acceptedAnswers ?? [answerText],
      explanation: input.explanation,
      concept: input.concept ?? skillById.get(input.skillId)?.description ?? '',
      estimatedSeconds: input.estimatedSeconds ?? 90 + input.difficulty * 12,
      source: 'local-original',
    }
  }

  const raw = [answerText, ...(input.distractors ?? [])].map(String)
  const unique = Array.from(new Set(raw))
  let bump = 1
  while (unique.length < 4) {
    const numeric = Number(input.answer)
    const candidate = Number.isFinite(numeric) ? String(numeric + bump * 2) : `Not enough information ${bump}`
    if (!unique.includes(candidate)) unique.push(candidate)
    bump += 1
  }
  const options = unique.slice(0, 4).sort(() => rng() - 0.5)
  const correctIndex = options.indexOf(answerText)
  const whyWrong: Record<string, string> = {}
  const misconceptionByChoice: Record<string, string> = {}
  const misconceptions = ['A sign or operation was reversed', 'The requested quantity was not isolated', 'An intermediate value was used as the final answer']
  options.forEach((option, index) => {
    if (index !== correctIndex) {
      const reason = input.distractorReasons?.[option] ?? misconceptions[index % misconceptions.length]
      misconceptionByChoice[letters[index]] = reason
      whyWrong[letters[index]] = `${reason}. Follow the worked steps and substitute to check.`
    }
  })
  return {
    id: `math-${input.skillId}-${input.seed}`,
    section: 'math',
    domain: domainForSkill(input.skillId),
    skillId: input.skillId,
    difficulty: input.difficulty,
    format: input.format,
    stimulus: input.stimulus,
    table: input.table,
    plot: input.plot,
    prompt: input.prompt,
    choices: options.map((text, index) => ({ id: letters[index], text })),
    answer: letters[correctIndex],
    explanation: input.explanation,
    concept: input.concept ?? skillById.get(input.skillId)?.description ?? '',
    whyWrong,
    misconceptionByChoice,
    estimatedSeconds: input.estimatedSeconds ?? 90 + input.difficulty * 12,
    source: 'local-original',
  }
}

const conceptualQuestion = (
  seed: number,
  skillId: string,
  difficulty: Difficulty,
  stimulus: string,
  prompt: string,
  choices: string[],
  answerIndex: number,
  explanation: string,
  table?: Question['table'],
  trapReasons?: string[],
): Question => {
  const rng = mulberry32(seed * 131 + skillId.length)
  const indexed = choices.map((text, index) => ({ text, correct: index === answerIndex, reason: trapReasons?.[index] })).sort(() => rng() - 0.5)
  const correctIndex = indexed.findIndex((choice) => choice.correct)
  return {
    id: `math-${skillId}-${seed}`,
    section: 'math',
    domain: domainForSkill(skillId),
    skillId,
    difficulty,
    format: 'multiple-choice',
    stimulus,
    table,
    prompt,
    choices: indexed.map((choice, index) => ({ id: letters[index], text: choice.text })),
    answer: letters[correctIndex],
    explanation,
    concept: skillById.get(skillId)?.description ?? '',
    whyWrong: Object.fromEntries(letters.filter((_, index) => index !== correctIndex).map((letter, index) => [letter, `${indexed[indexed.findIndex((_, choiceIndex) => letters[choiceIndex] === letter)]?.reason ?? 'This conclusion does not follow from the stated relationship or data.'} Recheck what the question asks.`])),
    misconceptionByChoice: Object.fromEntries(letters.filter((_, index) => index !== correctIndex).map((letter) => {
      const choiceIndex = letters.indexOf(letter)
      return [letter, indexed[choiceIndex]?.reason ?? 'The conclusion does not follow from the stated relationship or data']
    })),
    estimatedSeconds: 85 + difficulty * 10,
    source: 'local-original',
  }
}

export const mathSkillIds = [
  'linear-equations-one-variable', 'linear-equations-two-variables', 'linear-functions', 'systems-linear-equations', 'linear-inequalities',
  'equivalent-expressions', 'nonlinear-equations', 'nonlinear-functions', 'systems-nonlinear',
  'ratios-rates-units', 'percentages', 'one-variable-data', 'two-variable-data', 'probability', 'sampling-margin-error', 'statistical-claims',
  'area-volume', 'lines-angles-triangles', 'right-triangle-trig', 'circles',
]

export function generateMathQuestion(skillId: string, difficulty: Difficulty, seed: number, requestedFormat?: QuestionFormat): Question {
  const rng = mulberry32(seed + difficulty * 1009)
  const format: QuestionFormat = requestedFormat ?? (seed % 4 === 0 ? 'student-produced' : 'multiple-choice')

  if (skillId === 'linear-equations-one-variable') {
    if (difficulty === 5) {
      const multiplier = int(rng, 2, 5)
      const a = int(rng, 2, 6)
      const bValue = int(rng, 2, 9)
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `k(${a}x + ${bValue}) = ${a * multiplier}x + ${bValue * multiplier}`, prompt: 'For what value of k does the equation have infinitely many solutions?', answer: multiplier, distractors: [-multiplier, a * multiplier, bValue * multiplier], distractorReasons: { [String(-multiplier)]: 'The sign of the common multiplier was reversed', [String(a * multiplier)]: 'Only the x-coefficient was compared instead of the full expressions', [String(bValue * multiplier)]: 'Only the constant term on the right was copied' }, explanation: `For infinitely many solutions, both sides must be identical. Multiplying ${a}x + ${bValue} by ${multiplier} produces ${a * multiplier}x + ${bValue * multiplier}, so k = ${multiplier}.`, estimatedSeconds: 110 })
    }
    if (difficulty === 4) {
      const x = int(rng, -7, 9)
      const a = int(rng, 2, 5)
      const b = a + int(rng, 1, 3)
      const p = int(rng, 1, 6)
      const r = int(rng, -4, 5)
      const q = int(rng, -7, 8)
      const s = a * (x + p) + q - b * (x + r)
      return numericQuestion({ seed, skillId, difficulty, format, prompt: `What is the solution to ${a}(x + ${p}) ${q >= 0 ? '+' : '-'} ${Math.abs(q)} = ${b}(x ${r >= 0 ? '+' : '-'} ${Math.abs(r)}) ${s >= 0 ? '+' : '-'} ${Math.abs(s)}?`, answer: x, distractors: [-x, x + p, x - r], explanation: `Distribute on both sides, collect the x-terms on one side and constants on the other, then divide. Substitution verifies x = ${x}.`, estimatedSeconds: 105 })
    }
    const x = int(rng, difficulty > 3 ? -12 : 2, 14)
    const a = int(rng, 2, 4 + difficulty)
    const bValue = int(rng, -9, 12)
    const c = a * x + bValue
    return numericQuestion({ seed, skillId, difficulty, format, prompt: `What is the solution to ${a}x ${bValue >= 0 ? '+' : '-'} ${Math.abs(bValue)} = ${c}?`, answer: x, distractors: [-x, c - bValue, x + a], explanation: `Subtract ${bValue} from both sides in the correct direction to get ${a}x = ${a * x}. Divide by ${a}, so x = ${x}.` })
  }

  if (skillId === 'linear-equations-two-variables') {
    if (difficulty >= 4) {
      const slope = int(rng, -5, 5) || 3
      const intercept = int(rng, -9, 9)
      const xs = difficulty === 5 ? [-3, 2, 7] : [-2, 1, 4]
      const table = { caption: 'Selected points on line ℓ', headers: ['x', 'y'], rows: xs.map((x) => [String(x), String(slope * x + intercept)]) }
      return numericQuestion({ seed, skillId, difficulty, format, table, prompt: 'Line ℓ is represented by the table. What is the y-coordinate of the y-intercept of line ℓ?', answer: intercept, distractors: [slope, -intercept, slope + intercept], distractorReasons: { [String(slope)]: 'The rate of change was reported instead of the intercept', [String(-intercept)]: 'The intercept sign was reversed', [String(slope + intercept)]: 'The slope and intercept were added without evaluating the linear relation' }, explanation: `The y-values change by ${slope} for each increase of 1 in x, so the slope is ${slope}. Using y = ${slope}x + b with any row gives b = ${intercept}.`, estimatedSeconds: 110 })
    }
    const slope = int(rng, 2, 6)
    const x1 = int(rng, -3, 4)
    const y1 = int(rng, -5, 7)
    const step = int(rng, 2, 5)
    const x2 = x1 + step
    const y2 = y1 + slope * step
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A line passes through (${x1}, ${y1}) and (${x2}, ${y2}).`, prompt: 'What is the slope of the line?', answer: slope, distractors: [step, y2 - y1, fraction(step, y2 - y1)], explanation: `Slope is change in y divided by change in x: (${y2} - ${y1})/(${x2} - ${x1}) = ${slope}.` })
  }

  if (skillId === 'linear-functions') {
    if (difficulty >= 4) {
      const m = int(rng, -5, 5) || 2
      const bValue = int(rng, -8, 8)
      const shift = int(rng, 2, 5)
      const drop = int(rng, 1, 6)
      const answer = m * shift + bValue - drop
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `The linear function f is defined by f(x) = ${m}x ${bValue >= 0 ? '+' : '-'} ${Math.abs(bValue)}. A second function is defined by g(x) = f(x + ${shift}) - ${drop}.`, prompt: 'What is the y-coordinate of the y-intercept of the graph of g?', answer, distractors: [bValue, m + shift - drop, m * -shift + bValue - drop], explanation: `At the y-intercept, x = 0. Thus g(0) = f(${shift}) - ${drop} = ${m}(${shift}) ${bValue >= 0 ? '+' : '-'} ${Math.abs(bValue)} - ${drop} = ${answer}.`, estimatedSeconds: difficulty === 5 ? 120 : 105 })
    }
    const m = int(rng, -5, 6) || 3
    const bValue = int(rng, -8, 9)
    const x = int(rng, 2, 8)
    const answer = m * x + bValue
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `The function f is defined by f(x) = ${m}x ${bValue >= 0 ? '+' : '-'} ${Math.abs(bValue)}.`, prompt: `What is f(${x})?`, answer, distractors: [m + x + bValue, m * x - bValue, answer + m], explanation: `Substitute ${x} for x: f(${x}) = ${m}(${x}) ${bValue >= 0 ? '+' : '-'} ${Math.abs(bValue)} = ${answer}.` })
  }

  if (skillId === 'systems-linear-equations') {
    if (difficulty === 5) {
      const scale = int(rng, 2, 5)
      const a = int(rng, 2, 5)
      const b = int(rng, 2, 6)
      const c = int(rng, 4, 12)
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `${a * scale}x + ${b * scale}y = ${c * scale}\n${a}x + ${b}y = k`, prompt: 'For what value of k does the system have infinitely many solutions?', answer: c, distractors: [c * scale, fraction(c, scale), a + b], explanation: `The first equation is ${scale} times the second only when its constant is also ${scale}k. Since ${scale}k = ${c * scale}, k = ${c}.`, estimatedSeconds: 115 })
    }
    if (difficulty === 4) {
      const x = int(rng, -4, 7)
      const y = int(rng, -3, 8)
      const c1 = 2 * x + 3 * y
      const c2 = 3 * x - 2 * y
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `2x + 3y = ${c1}\n3x - 2y = ${c2}`, prompt: 'What is the value of x + y?', answer: x + y, distractors: [x, y, x - y], explanation: `Eliminate one variable from the system to obtain x = ${x} and y = ${y}. Therefore x + y = ${x + y}.`, estimatedSeconds: 115 })
    }
    const x = int(rng, 1, 8)
    const y = int(rng, 1, 8)
    const a = int(rng, 2, 5)
    const c1 = x + y
    const c2 = a * x - y
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `x + y = ${c1}\n${a}x - y = ${c2}`, prompt: 'What is the value of x?', answer: x, distractors: [y, c1, x + y], explanation: `Add the equations to eliminate y: ${a + 1}x = ${c1 + c2}. Therefore x = ${x}.` })
  }

  if (skillId === 'linear-inequalities') {
    if (difficulty === 5) {
      return conceptualQuestion(seed, skillId, difficulty, `y ≤ x + 3\ny ≥ -2x - 1`, 'Which point (x, y) is a solution to the given system of inequalities?', ['(-4, 0)', '(0, -4)', '(0, 4)', '(4, 0)'], 3, 'Substitute each ordered pair into both inequalities. Only (4, 0) makes both statements true.', undefined, ['The point fails y ≤ x + 3', 'The point fails y ≥ -2x - 1', 'The point fails y ≤ x + 3', 'Supported'])
    }
    if (difficulty === 4) {
      const boundary = int(rng, 2, 8)
      return conceptualQuestion(seed, skillId, difficulty, `-3(2x - ${boundary}) > 6x + ${3 * boundary}`, 'Which choice gives the solution set?', [`x < 0`, `x > 0`, `x < ${boundary}`, `x > ${boundary}`], 0, 'Distribute, collect the x-terms, and divide by a negative coefficient, reversing the inequality. The constants cancel to give x < 0.')
    }
    const boundary = int(rng, -7, 9)
    const a = int(rng, 2, 6)
    const offset = int(rng, 1, 8)
    const c = -a * boundary
    return conceptualQuestion(seed, skillId, difficulty, `-${a}x + ${offset} ≤ ${c + offset}`, 'Which choice gives the solution set?', [`x ≥ ${boundary}`, `x ≤ ${boundary}`, `x > ${-boundary}`, `x < ${-boundary}`], 0, `After isolating -${a}x, divide by a negative number and reverse the inequality. The result is x ≥ ${boundary}.`)
  }

  if (skillId === 'equivalent-expressions') {
    if (difficulty >= 4) {
      const a = int(rng, 2, 5)
      const b = int(rng, 2, 8)
      const c = int(rng, 2, 5)
      const d = int(rng, 1, 7)
      const outer = difficulty === 5 ? int(rng, 2, 4) : 1
      const subtract = difficulty === 5 ? int(rng, 2, 9) : 0
      const coefficient = outer * (b * c - a * d) - subtract
      const expression = `${outer === 1 ? '' : `${outer}`}(${a}x + ${b})(${c}x - ${d})${subtract ? ` - ${subtract}x` : ''}`
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: expression, prompt: 'When the given expression is written in the form ax² + bx + c, what is the value of b?', answer: coefficient, distractors: [outer * a * c, -outer * b * d, outer * (b * c + a * d) - subtract], explanation: `The x-terms from the product have coefficient ${b * c} - ${a * d} = ${b * c - a * d}. After multiplying by ${outer}${subtract ? ` and subtracting ${subtract}x` : ''}, the coefficient of x is ${coefficient}.`, estimatedSeconds: 120 })
    }
    const p = int(rng, 2, 7)
    const q = int(rng, 2, 9)
    return conceptualQuestion(seed, skillId, difficulty, `${p * p}x² - ${q * q}`, 'Which expression is equivalent to the given expression?', [`(${p}x - ${q})(${p}x + ${q})`, `(${p}x - ${q})²`, `(${p}x + ${q})²`, `(${p * p}x - ${q})(${p * p}x + ${q})`], 0, `This is a difference of squares: (${p}x)² - ${q}² = (${p}x - ${q})(${p}x + ${q}).`)
  }

  if (skillId === 'nonlinear-equations') {
    if (difficulty === 5) {
      const d = int(rng, 1, 3)
      const root = int(rng, 2 * d + 2, 2 * d + 7)
      const c = (root - d) ** 2 - root
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `√(x + ${c}) = x - ${d}`, prompt: 'What is the solution to the given equation?', answer: root, distractors: [2 * d + 1 - root, root - d, root + d], distractorReasons: { [String(2 * d + 1 - root)]: 'The extraneous root created by squaring was not checked in the original equation', [String(root - d)]: 'The value of the square root was reported instead of x', [String(root + d)]: 'The isolated constant was added twice' }, explanation: `Square both sides, solve the resulting quadratic, and check every candidate in the original equation. The candidate ${2 * d + 1 - root} makes the right side negative and is extraneous; x = ${root} works.`, estimatedSeconds: 135 })
    }
    const r1 = int(rng, 1, 7)
    const r2 = r1 + int(rng, 2, 6)
    const sum = r1 + r2
    const product = r1 * r2
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `x² - ${sum}x + ${product} = 0`, prompt: difficulty >= 4 ? 'What is the larger solution?' : 'What is the sum of the solutions?', answer: difficulty >= 4 ? r2 : sum, distractors: [r1, product, -sum], explanation: `Factor the equation as (x - ${r1})(x - ${r2}) = 0. The solutions are ${r1} and ${r2}.` })
  }

  if (skillId === 'nonlinear-functions') {
    if (difficulty === 5) {
      const base = pick(rng, [0.36, 0.49, 0.64, 0.81])
      const percent = Math.round((1 - base) * 100)
      const distractorA = Math.round(base * 100)
      const distractorB = Math.round((1 - Math.sqrt(base)) * 100)
      return conceptualQuestion(seed, skillId, difficulty, `The value V, in dollars, of a machine after x months is modeled by V(x) = 8,400(${base})^(x/12). The value decreases each year by p% of its value at the beginning of that year.`, 'What is the value of p?', [String(percent), String(distractorA), String(distractorB), String(Math.round(percent / 12))], 0, `Increasing x by 12 multiplies V by ${base}. The machine retains ${distractorA}% of its value and therefore loses ${percent}% each year, so p = ${percent}.`, undefined, ['Supported', 'This is the percentage retained, not the percentage lost', 'A square-root rate is not justified because the exponent already measures years', 'The annual percentage was incorrectly divided evenly across months'])
    }
    if (difficulty === 4) {
      const initial = int(rng, 3, 8)
      const ratio = pick(rng, [2, 3])
      const rows = [0, 1, 2, 3].map((x) => [String(x), String(initial * ratio ** x)])
      return conceptualQuestion(seed, skillId, difficulty, '', 'Which function is represented by the table?', [`f(x) = ${initial}(${ratio})^x`, `f(x) = ${ratio}(${initial})^x`, `f(x) = ${initial}x + ${ratio}`, `f(x) = ${initial + ratio}(${ratio})^x`], 0, `The value at x = 0 is ${initial}, and each y-value is ${ratio} times the previous value. Thus f(x) = ${initial}(${ratio})^x.`, { caption: 'Selected values of f', headers: ['x', 'f(x)'], rows }, ['Supported', 'The initial value and growth factor were exchanged', 'A constant ratio indicates an exponential, not linear, function', 'The initial value was incorrectly increased by the growth factor'])
    }
    const h = int(rng, -5, 6) || 2
    const k = int(rng, -8, 7) || -3
    return conceptualQuestion(seed, skillId, difficulty, `g(x) = ${int(rng, 1, 4)}(x ${h >= 0 ? '-' : '+'} ${Math.abs(h)})² ${k >= 0 ? '+' : '-'} ${Math.abs(k)}`, 'What is the vertex of the graph of g?', [`(${h}, ${k})`, `(${-h}, ${k})`, `(${h}, ${-k})`, `(${-h}, ${-k})`], 0, `Vertex form a(x - h)² + k has vertex (h, k), so the vertex is (${h}, ${k}).`)
  }

  if (skillId === 'systems-nonlinear') {
    if (difficulty === 5) {
      const h = int(rng, -4, 5)
      const k = int(rng, 2, 9)
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `y = (x ${h >= 0 ? '-' : '+'} ${Math.abs(h)})² + ${k}\ny = c`, prompt: 'For what value of c does the system have exactly one solution?', answer: k, distractors: [h, -k, h + k], explanation: `The parabola has its minimum at (${h}, ${k}). A horizontal line y = c intersects it exactly once only at the vertex, so c = ${k}.`, estimatedSeconds: 115 })
    }
    const r1 = int(rng, -4, -1)
    const r2 = int(rng, 2, 6)
    const slope = r1 + r2
    const intercept = -r1 * r2
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `y = x²\ny = ${slope}x ${intercept >= 0 ? '+' : '-'} ${Math.abs(intercept)}`, prompt: 'What is the sum of the x-coordinates of the intersection points?', answer: slope, distractors: [intercept, r2 - r1, -slope], explanation: `Set the equations equal. The resulting quadratic has roots ${r1} and ${r2}, whose sum is ${slope}.` })
  }

  if (skillId === 'ratios-rates-units') {
    if (difficulty >= 4) {
      const metersPerSecond = int(rng, 4, 12)
      const minutes = int(rng, 3, 9)
      const meters = metersPerSecond * minutes * 60
      const kilometers = meters / 1000
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A robotic cart travels at a constant speed of ${metersPerSecond} meters per second for ${minutes} minutes.`, prompt: 'How many kilometers does the cart travel?', answer: kilometers, acceptedAnswers: [String(kilometers), fraction(meters, 1000)], distractors: [metersPerSecond * minutes, meters, kilometers * 60], distractorReasons: { [String(metersPerSecond * minutes)]: 'Minutes were used with a per-second rate without converting time', [String(meters)]: 'The distance was left in meters instead of kilometers', [String(kilometers * 60)]: 'The time conversion was applied twice' }, explanation: `${minutes} minutes is ${minutes * 60} seconds. The distance is ${metersPerSecond} × ${minutes * 60} = ${meters} meters, or ${kilometers} kilometers.`, estimatedSeconds: difficulty === 5 ? 120 : 105 })
    }
    const hours = int(rng, 2, 6)
    const rate = int(rng, 35, 75)
    const distance = hours * rate
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A train travels ${distance} kilometers at a constant speed in ${hours} hours.`, prompt: 'What is its speed in kilometers per hour?', answer: rate, distractors: [distance * hours, distance - hours, rate * 2], explanation: `Unit rate is distance divided by time: ${distance}/${hours} = ${rate} kilometers per hour.` })
  }

  if (skillId === 'percentages') {
    if (difficulty >= 4) {
      const increase = pick(rng, [20, 25, 40, 50])
      const original = pick(rng, [80, 120, 160, 200])
      const increased = original * (1 + increase / 100)
      const decrease = pick(rng, [10, 20, 25])
      const final = increased * (1 - decrease / 100)
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A quantity is increased by ${increase}% and then the resulting quantity is decreased by ${decrease}%. The final value is ${final}.`, prompt: 'What was the original value?', answer: original, distractors: [final, final / (1 + (increase - decrease) / 100), increased], explanation: `Let the original value be x. The changes multiply it by ${1 + increase / 100} and then by ${1 - decrease / 100}, so ${1 + increase / 100}(${1 - decrease / 100})x = ${final}. Solving gives x = ${original}.`, estimatedSeconds: 120 })
    }
    const original = pick(rng, [80, 120, 160, 200, 240])
    const percent = pick(rng, [10, 15, 20, 25])
    const change = (original * percent) / 100
    const answer = original + change
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A membership fee of $${original} is increased by ${percent}%.`, prompt: 'What is the new fee, in dollars?', answer, distractors: [change, original - change, original + percent], explanation: `${percent}% of ${original} is ${change}. Add this to the original fee: ${original} + ${change} = ${answer}.` })
  }

  if (skillId === 'one-variable-data') {
    if (difficulty >= 4) {
      const shift = int(rng, 12, 40)
      const rows = [['12', '4'], ['13', '3'], ['14', '4'], ['15', '2'], ['16', '2']]
      const question = conceptualQuestion(seed, skillId, difficulty, `Data set B is created by adding ${shift} to each of the 15 values in data set A.`, 'Which statement correctly compares the medians and ranges of data sets A and B?', ['The median of B is greater than the median of A, and the ranges are equal.', 'The medians are equal, and the range of B is greater.', 'Both the median and the range of B are greater.', 'Both the medians and the ranges are equal.'], 0, `Adding ${shift} to every value adds ${shift} to the median but leaves every pairwise difference—and therefore the range—unchanged.`, { caption: 'Data set A', headers: ['Value', 'Frequency'], rows }, ['Supported', 'A uniform shift changes the center but not the spread', 'A uniform shift does not change the range', 'The median increases under a positive uniform shift'])
      if (difficulty === 5) {
        const points = rows.flatMap(([value, frequency]) => Array.from({ length: Number(frequency) }, (_, index) => ({ x: Number(value), y: index + 1 })))
        return { ...question, table: undefined, plot: { kind: 'dot', caption: 'Dot plot of data set A', xLabel: 'Value', points } }
      }
      return question
    }
    const center = int(rng, 8, 18)
    const values = [center - 4, center - 2, center, center + 1, center + 9]
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `The data set is ${values.join(', ')}.`, prompt: difficulty >= 3 ? 'What is the median?' : 'What is the range?', answer: difficulty >= 3 ? center : 13, distractors: [center + 9, center - 4, center + 1], explanation: difficulty >= 3 ? `The values are already sorted, so the middle value is ${center}.` : `Range is maximum minus minimum: ${center + 9} - ${center - 4} = 13.` })
  }

  if (skillId === 'two-variable-data') {
    if (difficulty >= 4) {
      const slope = int(rng, 2, 6)
      const intercept = int(rng, -5, 8)
      const xs = [1, 3, 6, 8]
      const rows = xs.map((x) => [String(x), String(slope * x + intercept)])
      return numericQuestion({ seed, skillId, difficulty, format, table: difficulty === 4 ? { caption: 'Selected values of x and y', headers: ['x', 'y'], rows } : undefined, plot: difficulty === 5 ? { kind: 'scatter', caption: 'Selected points in the xy-plane', xLabel: 'x', yLabel: 'y', points: xs.map((x) => ({ x, y: slope * x + intercept })) } : undefined, prompt: 'The relationship between x and y is linear. What is the slope of the line that models the data?', answer: slope, distractors: [intercept, fraction(1, slope), slope + intercept], explanation: `Using any two points, slope = change in y/change in x. For example, (${slope * 3 + intercept} - ${slope + intercept})/(3 - 1) = ${slope}.`, estimatedSeconds: 100 })
    }
    const observed = int(rng, 20, 45)
    const residual = int(rng, -7, 8) || 4
    const predicted = observed - residual
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A line of best fit predicts ${predicted} units for an observation whose actual value is ${observed} units.`, prompt: 'What is the residual?', answer: residual, distractors: [-residual, predicted, observed + predicted], explanation: `Residual equals observed minus predicted: ${observed} - ${predicted} = ${residual}.` })
  }

  if (skillId === 'probability') {
    if (difficulty >= 4) {
      const seniorTeam = int(rng, 8, 14)
      const seniorNot = int(rng, 5, 11)
      const juniorTeam = int(rng, 7, 13)
      const juniorNot = int(rng, 8, 15)
      const seniorTotal = seniorTeam + seniorNot
      const answer = fraction(seniorTeam, seniorTotal)
      return numericQuestion({ seed, skillId, difficulty, format, table: { caption: 'Club membership', headers: ['', 'Team leader', 'Not a team leader'], rows: [['Senior', String(seniorTeam), String(seniorNot)], ['Junior', String(juniorTeam), String(juniorNot)]] }, prompt: 'A senior is selected at random. What is the probability that the selected senior is a team leader?', answer, acceptedAnswers: [answer, String(seniorTeam / seniorTotal)], distractors: [fraction(seniorTeam, seniorTeam + seniorNot + juniorTeam + juniorNot), fraction(seniorTeam, seniorTeam + juniorTeam), fraction(seniorNot, seniorTotal)], explanation: `Because the student is known to be a senior, restrict the sample space to the ${seniorTotal} seniors. Of those, ${seniorTeam} are team leaders, so the probability is ${answer}.`, estimatedSeconds: 115 })
    }
    const group = int(rng, 18, 30)
    const favorable = int(rng, 3, Math.floor(group / 2))
    const answer = fraction(favorable, group)
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `Of ${group} students in a club, ${favorable} are both seniors and team leaders. A student is selected at random from the club.`, prompt: 'What is the probability that the selected student is both a senior and a team leader?', answer, acceptedAnswers: [answer, String(favorable / group)], distractors: [fraction(group - favorable, group), fraction(favorable, group - favorable), String(favorable)], explanation: `Use favorable outcomes over total outcomes: ${favorable}/${group}, which simplifies to ${answer}.` })
  }

  if (skillId === 'sampling-margin-error') {
    return conceptualQuestion(seed, skillId, difficulty, 'Two surveys use the same random sampling method. Survey A samples 400 voters, and Survey B samples 1,600 voters.', 'Which statement is most likely true?', ['Survey B has a smaller margin of error.', 'Survey A is more representative solely because it is smaller.', 'Both surveys must have identical results.', 'Survey B can prove a causal relationship.'], 0, 'With the same random method, the larger sample generally reduces sampling variability and margin of error.')
  }

  if (skillId === 'statistical-claims') {
    return conceptualQuestion(seed, skillId, difficulty, 'Researchers randomly assign volunteers to use either a standing desk or a seated desk for four weeks, then compare reported back discomfort.', 'Which conclusion is best supported by this design?', ['A difference in discomfort can be attributed to desk assignment for volunteers like those studied.', 'Standing desks reduce discomfort for every office worker.', 'The result can be generalized to all adults because assignment was random.', 'The study can show association only because no treatment was imposed.'], 0, 'Random assignment supports a causal comparison for the studied volunteers, but the volunteer sample does not justify a claim about every worker.')
  }

  if (skillId === 'area-volume') {
    if (difficulty >= 4) {
      const volume = pick(rng, [48, 72, 96, 120])
      const scale = pick(rng, [2, 3])
      const answer = volume * scale ** 3
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `Solid B is similar to solid A. Every linear dimension of solid B is ${scale} times the corresponding dimension of solid A. The volume of solid A is ${volume} cubic units.`, prompt: 'What is the volume, in cubic units, of solid B?', answer, distractors: [volume * scale, volume * scale ** 2, volume + scale ** 3], distractorReasons: { [String(volume * scale)]: 'The linear scale factor was applied directly to volume', [String(volume * scale ** 2)]: 'The area scale factor was used instead of the volume scale factor', [String(volume + scale ** 3)]: 'The scale factor was added rather than multiplied' }, explanation: `Volumes of similar solids scale by the cube of the linear factor. Therefore the volume is ${volume}(${scale}³) = ${answer}.`, estimatedSeconds: 110 })
    }
    const radius = int(rng, 2, 7)
    const height = int(rng, 3, 10)
    const coefficient = radius * radius * height
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A right circular cylinder has radius ${radius} centimeters and height ${height} centimeters.`, prompt: 'What is its volume, in cubic centimeters, divided by π?', answer: coefficient, distractors: [2 * radius * height, radius * height, radius * radius + height], explanation: `V = πr²h = π(${radius}²)(${height}) = ${coefficient}π. Dividing by π gives ${coefficient}.` })
  }

  if (skillId === 'lines-angles-triangles') {
    if (difficulty >= 4) {
      const x = int(rng, 8, 16)
      const a1 = 2 * x + 4
      const a2 = 3 * x - 5
      const a3 = 180 - a1 - a2
      const constant = a3 - x
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `The angle measures of a triangle are (2x + 4)°, (3x - 5)°, and (x + ${constant})°.`, prompt: 'What is the measure, in degrees, of the largest angle?', answer: Math.max(a1, a2, a3), distractors: [x, a1, a3], explanation: `Set the sum of the three expressions equal to 180° to get x = ${x}. The angle measures are ${a1}°, ${a2}°, and ${a3}°, so the largest is ${Math.max(a1, a2, a3)}°.`, estimatedSeconds: 120 })
    }
    const angle1 = int(rng, 35, 75)
    const angle2 = int(rng, 35, 75)
    const angle3 = 180 - angle1 - angle2
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `Two angles of a triangle measure ${angle1}° and ${angle2}°.` , prompt: 'What is the measure, in degrees, of the third angle?', answer: angle3, distractors: [angle1 + angle2, 360 - angle1 - angle2, Math.abs(angle1 - angle2)], explanation: `Triangle angles sum to 180°. The third angle is 180 - ${angle1} - ${angle2} = ${angle3}°.` })
  }

  if (skillId === 'right-triangle-trig') {
    if (difficulty >= 4) {
      const scale = int(rng, 3, 9)
      const hypotenuse = 5 * scale
      const opposite = 3 * scale
      const adjacent = 4 * scale
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `In right triangle ABC, angle C is 90°. For angle A, sin A = 3/5. The hypotenuse AB has length ${hypotenuse}.`, prompt: 'What is the length of side AC?', answer: adjacent, distractors: [opposite, hypotenuse, fraction(3 * hypotenuse, 5)], distractorReasons: { [String(opposite)]: 'The side opposite angle A was found instead of the adjacent side AC', [String(hypotenuse)]: 'The given hypotenuse was reported without using the ratio' }, explanation: `sin A = opposite/hypotenuse = 3/5, so the side ratios form a 3-4-5 triangle. With hypotenuse ${hypotenuse}, the scale is ${scale}, and adjacent side AC = 4(${scale}) = ${adjacent}.`, estimatedSeconds: 110 })
    }
    const scale = int(rng, 2, 7)
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `In a right triangle, relative to angle θ, the opposite side is ${3 * scale} and the adjacent side is ${4 * scale}.`, prompt: 'What is tan θ?', answer: '3/4', acceptedAnswers: ['3/4', '0.75'], distractors: ['4/3', '3/5', '4/5'], explanation: `tan θ = opposite/adjacent = ${3 * scale}/${4 * scale} = 3/4.` })
  }

  if (skillId === 'circles') {
    if (difficulty >= 4) {
      const h = int(rng, -6, 6)
      const k = int(rng, -6, 6)
      const radius = int(rng, 3, 9)
      const d = -2 * h
      const e = -2 * k
      const right = radius ** 2 - h ** 2 - k ** 2
      const signTerm = (coefficient: number, variable: string) => `${coefficient >= 0 ? '+' : '-'} ${Math.abs(coefficient)}${variable}`
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `x² + y² ${signTerm(d, 'x')} ${signTerm(e, 'y')} = ${right}`, prompt: 'What is the radius of the circle represented by the equation?', answer: radius, distractors: [radius ** 2, Math.abs(h), Math.abs(k)], explanation: `Complete the square in x and y. The equation becomes (x ${h >= 0 ? '-' : '+'} ${Math.abs(h)})² + (y ${k >= 0 ? '-' : '+'} ${Math.abs(k)})² = ${radius ** 2}, so the radius is ${radius}.`, estimatedSeconds: difficulty === 5 ? 135 : 115 })
    }
    const radius = int(rng, 3, 9)
    const angle = pick(rng, [60, 90, 120, 180])
    const coefficient = fraction(angle * 2 * radius, 360)
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A circle has radius ${radius}. A central angle of ${angle}° intercepts an arc.`, prompt: 'What is the arc length divided by π?', answer: coefficient, acceptedAnswers: [coefficient, String((angle * 2 * radius) / 360)], distractors: [fraction(angle * radius * radius, 360), String(2 * radius), String(angle / 360)], explanation: `Arc length is ${angle}/360 × 2π(${radius}). Dividing by π gives ${coefficient}.` })
  }

  return generateMathQuestion('linear-equations-one-variable', difficulty, seed, format)
}
