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

function generateDifficultyTwoQuestion(skillId: string, seed: number, format: QuestionFormat, rng: Rng): Question | null {
  if (skillId === 'linear-equations-one-variable') {
    const weeks = int(rng, 4, 9)
    const weekly = int(rng, 6, 14)
    const starting = int(rng, 18, 45)
    const total = starting + weeks * weekly
    return numericQuestion({ seed, skillId, difficulty: 2, format, stimulus: `Mara has $${starting} saved and adds the same amount each week. After ${weeks} weeks, she has $${total}.`, prompt: 'How many dollars does Mara add each week?', answer: weekly, distractors: [total - starting, total / weeks, starting + weeks], explanation: `If w is the weekly amount, ${starting} + ${weeks}w = ${total}. Subtract ${starting} and divide by ${weeks}, giving w = ${weekly}.`, estimatedSeconds: 85 })
  }
  if (skillId === 'linear-equations-two-variables') {
    const a = int(rng, 2, 6)
    const b = int(rng, 2, 7)
    const intercept = int(rng, 3, 10)
    return numericQuestion({ seed, skillId, difficulty: 2, format, stimulus: `${a}x + ${b}y = ${b * intercept}`, prompt: 'What is the y-coordinate of the y-intercept of the line represented by the equation?', answer: intercept, distractors: [a, b, b * intercept], explanation: `At the y-intercept, x = 0. Then ${b}y = ${b * intercept}, so y = ${intercept}.`, estimatedSeconds: 80 })
  }
  if (skillId === 'linear-functions') {
    const rate = int(rng, 2, 7)
    const initial = int(rng, 8, 24)
    const xs = [0, 2, 4]
    return numericQuestion({ seed, skillId, difficulty: 2, format, table: { caption: 'Amount of water in a tank', headers: ['Minutes', 'Liters'], rows: xs.map((x) => [String(x), String(initial + rate * x)]) }, prompt: 'The relationship is linear. At what rate, in liters per minute, is water added to the tank?', answer: rate, distractors: [initial, rate * 2, initial + rate], explanation: `From 0 to 2 minutes, the amount increases by ${rate * 2} liters. The unit rate is ${rate * 2}/2 = ${rate} liters per minute.`, estimatedSeconds: 85 })
  }
  if (skillId === 'systems-linear-equations') {
    const adult = int(rng, 3, 8)
    const child = int(rng, 4, 10)
    const total = adult + child
    const revenue = adult * 8 + child * 5
    return numericQuestion({ seed, skillId, difficulty: 2, format, stimulus: `A theater sold ${total} tickets for $${revenue}. Adult tickets cost $8 each, and child tickets cost $5 each.`, prompt: 'How many adult tickets were sold?', answer: adult, distractors: [child, total, revenue / 8], explanation: `Let a + c = ${total} and 8a + 5c = ${revenue}. Substituting c = ${total} - a gives a = ${adult}.`, estimatedSeconds: 95 })
  }
  if (skillId === 'linear-inequalities') {
    const fixed = int(rng, 12, 25)
    const each = int(rng, 4, 9)
    const budget = fixed + each * int(rng, 5, 10)
    return conceptualQuestion(seed, skillId, 2, `A delivery service charges a fixed fee of $${fixed} plus $${each} per package. A customer can spend at most $${budget}.`, 'If p is the number of packages, which inequality represents the situation?', [`${fixed} + ${each}p ≤ ${budget}`, `${fixed} + ${each}p ≥ ${budget}`, `${each} + ${fixed}p ≤ ${budget}`, `${each}p - ${fixed} ≥ ${budget}`], 0, 'The fixed fee plus the per-package cost cannot exceed the budget.', undefined, ['Supported', 'At most means less than or equal to', 'The fixed and variable costs were exchanged', 'The fixed fee should be added'])
  }
  if (skillId === 'equivalent-expressions') {
    const a = int(rng, 2, 6)
    const b = int(rng, 2, 8)
    const c = int(rng, 1, 5)
    return conceptualQuestion(seed, skillId, 2, `${a}(x + ${b}) - ${c}x`, 'Which expression is equivalent to the given expression?', [`${a - c}x + ${a * b}`, `${a - c}x + ${b}`, `${a + c}x + ${a * b}`, `${a * c}x + ${a * b}`], 0, `Distribute ${a} and combine like terms: ${a}x + ${a * b} - ${c}x = ${a - c}x + ${a * b}.`)
  }
  if (skillId === 'nonlinear-equations') {
    const first = int(rng, 2, 6)
    const second = first + int(rng, 2, 5)
    return numericQuestion({ seed, skillId, difficulty: 2, format, stimulus: `(x - ${first})(x - ${second}) = 0`, prompt: 'What is the larger solution to the equation?', answer: second, distractors: [first, -second, first + second], explanation: `The zero-product property gives x = ${first} or x = ${second}. The larger solution is ${second}.`, estimatedSeconds: 80 })
  }
  if (skillId === 'nonlinear-functions') {
    const initial = int(rng, 2, 7)
    const ratio = pick(rng, [2, 3])
    const rows = [0, 1, 2].map((x) => [String(x), String(initial * ratio ** x)])
    return conceptualQuestion(seed, skillId, 2, '', 'Which equation represents the exponential function shown in the table?', [`f(x) = ${initial}(${ratio})^x`, `f(x) = ${ratio}(${initial})^x`, `f(x) = ${initial}x + ${ratio}`, `f(x) = ${initial + ratio}x`], 0, `The value at x = 0 is ${initial}, and each output is multiplied by ${ratio}.`, { caption: 'Selected values of f', headers: ['x', 'f(x)'], rows })
  }
  if (skillId === 'systems-nonlinear') {
    const x = int(rng, 2, 6)
    const y = x ** 2
    return conceptualQuestion(seed, skillId, 2, `y = x²\ny = ${x}x`, 'Which ordered pair is a solution to the system?', [`(${x}, ${y})`, `(${y}, ${x})`, `(${-x}, ${y})`, `(${x}, ${x})`], 0, `For x = ${x}, both equations give y = ${y}. The other listed points do not satisfy both equations.`)
  }
  if (skillId === 'ratios-rates-units') {
    const original = int(rng, 3, 6)
    const scaled = original * int(rng, 2, 4)
    const cups = int(rng, 2, 5)
    const answer = cups * scaled / original
    return numericQuestion({ seed, skillId, difficulty: 2, format, stimulus: `A recipe uses ${cups} cups of flour to make ${original} servings. The recipe is scaled to make ${scaled} servings.`, prompt: 'How many cups of flour are needed?', answer, distractors: [cups + scaled - original, cups * original, scaled / cups], explanation: `Keep the flour-to-serving ratio constant: ${cups}/${original} = x/${scaled}. Solving gives x = ${answer}.`, estimatedSeconds: 80 })
  }
  if (skillId === 'percentages') {
    const original = pick(rng, [60, 80, 120, 160])
    const discount = pick(rng, [15, 20, 25])
    const answer = original * (1 - discount / 100)
    return numericQuestion({ seed, skillId, difficulty: 2, format, stimulus: `A jacket originally costs $${original} and is discounted by ${discount}%.`, prompt: 'What is the sale price, in dollars?', answer, distractors: [original * discount / 100, original + original * discount / 100, original - discount], explanation: `The discount is ${discount}% of ${original}. Subtract that amount from the original price to get $${answer}.`, estimatedSeconds: 80 })
  }
  if (skillId === 'one-variable-data') {
    const values = [int(rng, 5, 9), int(rng, 10, 14), int(rng, 15, 19), int(rng, 20, 24)]
    const total = values.reduce((sum, value) => sum + value, 0)
    const extra = int(rng, 10, 25)
    const answer = (total + extra) / 5
    return numericQuestion({ seed, skillId, difficulty: 2, format, stimulus: `Four measurements are ${values.join(', ')}. A fifth measurement of ${extra} is added.`, prompt: 'What is the mean of the five measurements?', answer, distractors: [total / 4, extra / 5, total + extra], explanation: `The five measurements have sum ${total + extra}. Divide by 5 to get a mean of ${answer}.`, estimatedSeconds: 85 })
  }
  if (skillId === 'two-variable-data') {
    const slope = int(rng, 2, 5)
    const intercept = int(rng, 3, 9)
    const xs = [1, 3, 5]
    return numericQuestion({ seed, skillId, difficulty: 2, format, table: { caption: 'Selected values of x and y', headers: ['x', 'y'], rows: xs.map((x) => [String(x), String(slope * x + intercept)]) }, prompt: 'The relationship between x and y is linear. What is the slope?', answer: slope, distractors: [intercept, slope * 2, fraction(1, slope)], explanation: `When x increases by 2, y increases by ${2 * slope}. The slope is ${2 * slope}/2 = ${slope}.`, estimatedSeconds: 85 })
  }
  if (skillId === 'probability') {
    const red = int(rng, 4, 9)
    const blue = int(rng, 5, 11)
    const green = int(rng, 3, 8)
    const total = red + blue + green
    return numericQuestion({ seed, skillId, difficulty: 2, format, table: { caption: 'Tiles in a bag', headers: ['Color', 'Number'], rows: [['Red', String(red)], ['Blue', String(blue)], ['Green', String(green)]] }, prompt: 'One tile is selected at random. What is the probability that it is blue?', answer: fraction(blue, total), acceptedAnswers: [fraction(blue, total), String(blue / total)], distractors: [fraction(red, total), fraction(blue, red + green), String(blue)], explanation: `There are ${total} tiles total and ${blue} favorable outcomes, so the probability is ${blue}/${total}, or ${fraction(blue, total)}.`, estimatedSeconds: 80 })
  }
  if (skillId === 'area-volume') {
    const base = int(rng, 6, 14)
    const height = int(rng, 4, 12)
    return numericQuestion({ seed, skillId, difficulty: 2, format, stimulus: `A triangle has a base of ${base} centimeters and a perpendicular height of ${height} centimeters.`, prompt: 'What is the area, in square centimeters, of the triangle?', answer: base * height / 2, distractors: [base * height, base + height, 2 * base + 2 * height], explanation: `Triangle area is one-half base times height: (1/2)(${base})(${height}) = ${base * height / 2}.`, estimatedSeconds: 75 })
  }
  if (skillId === 'lines-angles-triangles') {
    const angle = int(rng, 42, 78)
    return numericQuestion({ seed, skillId, difficulty: 2, format, stimulus: `Two parallel lines are cut by a transversal. One of the acute angles formed measures ${angle}°.` , prompt: 'What is the measure, in degrees, of any obtuse angle formed?', answer: 180 - angle, distractors: [angle, 90 - angle, 180 + angle], explanation: `Each obtuse angle is supplementary to an adjacent ${angle}° acute angle, so its measure is 180 - ${angle} = ${180 - angle}°.`, estimatedSeconds: 75 })
  }
  if (skillId === 'right-triangle-trig') {
    const scale = int(rng, 2, 7)
    return numericQuestion({ seed, skillId, difficulty: 2, format, stimulus: `A right triangle has a hypotenuse of ${5 * scale} and one leg of ${3 * scale}.`, prompt: 'What is the length of the other leg?', answer: 4 * scale, distractors: [2 * scale, 3 * scale, 5 * scale], explanation: `By the Pythagorean theorem, the missing leg is √((${5 * scale})² - (${3 * scale})²) = ${4 * scale}.`, estimatedSeconds: 85 })
  }
  if (skillId === 'circles') {
    const radius = int(rng, 3, 10)
    return numericQuestion({ seed, skillId, difficulty: 2, format, stimulus: `A circle has a diameter of ${2 * radius} centimeters.`, prompt: 'What is its circumference, in centimeters, divided by π?', answer: 2 * radius, distractors: [radius, radius ** 2, 4 * radius], explanation: `Circumference is π times the diameter. Dividing by π leaves the diameter, ${2 * radius}.`, estimatedSeconds: 75 })
  }
  return null
}

export function generateMathQuestion(skillId: string, difficulty: Difficulty, seed: number, requestedFormat?: QuestionFormat): Question {
  const rng = mulberry32(seed + difficulty * 1009)
  const format: QuestionFormat = requestedFormat ?? (seed % 4 === 0 ? 'student-produced' : 'multiple-choice')
  if (difficulty === 2) {
    const question = generateDifficultyTwoQuestion(skillId, seed, format, rng)
    if (question) return question
  }

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
    if (difficulty === 3) {
      const hours = int(rng, 4, 9)
      const hourly = int(rng, 5, 12)
      const fixed = int(rng, 12, 28)
      const total = fixed + hourly * hours
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A bicycle rental costs a fixed fee of $${fixed} plus $${hourly} for each hour. A customer pays $${total}.`, prompt: 'For how many hours did the customer rent the bicycle?', answer: hours, distractors: [total / hourly, hours + fixed, total - fixed], distractorReasons: { [String(total / hourly)]: 'The fixed fee was not removed before dividing', [String(total - fixed)]: 'The hourly cost was found but not converted to hours' }, explanation: `Let h be the number of hours. The situation gives ${fixed} + ${hourly}h = ${total}. Subtract ${fixed}, then divide by ${hourly}, giving h = ${hours}.`, estimatedSeconds: 100 })
    }
    const x = int(rng, difficulty > 3 ? -12 : 2, 14)
    const a = int(rng, 2, 4 + difficulty)
    const bValue = int(rng, -9, 12)
    const c = a * x + bValue
    return numericQuestion({ seed, skillId, difficulty, format, prompt: `What is the solution to ${a}x ${bValue >= 0 ? '+' : '-'} ${Math.abs(bValue)} = ${c}?`, answer: x, distractors: [-x, c - bValue, x + a], explanation: `Subtract ${bValue} from both sides in the correct direction to get ${a}x = ${a * x}. Divide by ${a}, so x = ${x}.` })
  }

  if (skillId === 'linear-equations-two-variables') {
    if (difficulty === 5) {
      const slopeNumerator = int(rng, 2, 6)
      const slopeDenominator = int(rng, 2, 7)
      const x1 = int(rng, -4, 2)
      const y1 = int(rng, -5, 5)
      const x2 = x1 + slopeDenominator
      const y2 = y1 + slopeNumerator
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `Line ℓ passes through (${x1}, ${y1}) and (${x2}, ${y2}). Line m is perpendicular to line ℓ in the xy-plane.`, prompt: 'What is the slope of line m?', answer: fraction(-slopeDenominator, slopeNumerator), acceptedAnswers: [fraction(-slopeDenominator, slopeNumerator), String(-slopeDenominator / slopeNumerator)], distractors: [fraction(slopeNumerator, slopeDenominator), fraction(-slopeNumerator, slopeDenominator), fraction(slopeDenominator, slopeNumerator)], explanation: `The slope of line ℓ is (${y2} - ${y1})/(${x2} - ${x1}) = ${fraction(slopeNumerator, slopeDenominator)}. A perpendicular line has the negative reciprocal slope, ${fraction(-slopeDenominator, slopeNumerator)}.`, estimatedSeconds: 120 })
    }
    if (difficulty >= 4) {
      const slope = int(rng, -5, 5) || 3
      const intercept = int(rng, -9, 9)
      const xs = [-2, 1, 4]
      const table = { caption: 'Selected points on line ℓ', headers: ['x', 'y'], rows: xs.map((x) => [String(x), String(slope * x + intercept)]) }
      return numericQuestion({ seed, skillId, difficulty, format, table, prompt: 'Line ℓ is represented by the table. What is the y-coordinate of the y-intercept of line ℓ?', answer: intercept, distractors: [slope, -intercept, slope + intercept], distractorReasons: { [String(slope)]: 'The rate of change was reported instead of the intercept', [String(-intercept)]: 'The intercept sign was reversed', [String(slope + intercept)]: 'The slope and intercept were added without evaluating the linear relation' }, explanation: `The y-values change by ${slope} for each increase of 1 in x, so the slope is ${slope}. Using y = ${slope}x + b with any row gives b = ${intercept}.`, estimatedSeconds: 110 })
    }
    if (difficulty === 3) {
      const x = int(rng, -4, 7)
      const y = int(rng, -5, 8)
      const a = int(rng, 2, 5)
      const b = int(rng, 2, 6)
      const c = a * x + b * y
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `The point (${x}, y) lies on the line ${a}x + ${b}y = ${c}.`, prompt: 'What is the value of y?', answer: y, distractors: [-y, c - a * x, fraction(c - a * x, a)], explanation: `Substitute x = ${x}: ${a}(${x}) + ${b}y = ${c}. This gives ${b}y = ${b * y}, so y = ${y}.`, estimatedSeconds: 95 })
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
    if (difficulty === 5) {
      const slope = int(rng, -5, 5) || 3
      const intercept = int(rng, -8, 8)
      const shift = int(rng, 2, 5)
      const drop = int(rng, 2, 6)
      const xs = [-2, 3]
      const table = { caption: 'Selected values of the linear function f', headers: ['x', 'f(x)'], rows: xs.map((x) => [String(x), String(slope * x + intercept)]) }
      const answer = slope * shift + intercept - drop
      return numericQuestion({ seed, skillId, difficulty, format, table, stimulus: `The function f is linear. A second function is defined by g(x) = f(x + ${shift}) - ${drop}.`, prompt: 'What is the y-coordinate of the y-intercept of the graph of g?', answer, distractors: [intercept, slope + shift - drop, intercept - slope * shift - drop], explanation: `The table gives slope ${slope} and y-intercept ${intercept}. At x = 0, g(0) = f(${shift}) - ${drop} = ${slope}(${shift}) + ${intercept} - ${drop} = ${answer}.`, estimatedSeconds: 125 })
    }
    if (difficulty >= 4) {
      const m = int(rng, -5, 5) || 2
      const bValue = int(rng, -8, 8)
      const shift = int(rng, 2, 5)
      const drop = int(rng, 1, 6)
      const answer = m * shift + bValue - drop
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `The linear function f is defined by f(x) = ${m}x ${bValue >= 0 ? '+' : '-'} ${Math.abs(bValue)}. A second function is defined by g(x) = f(x + ${shift}) - ${drop}.`, prompt: 'What is the y-coordinate of the y-intercept of the graph of g?', answer, distractors: [bValue, m + shift - drop, m * -shift + bValue - drop], explanation: `At the y-intercept, x = 0. Thus g(0) = f(${shift}) - ${drop} = ${m}(${shift}) ${bValue >= 0 ? '+' : '-'} ${Math.abs(bValue)} - ${drop} = ${answer}.`, estimatedSeconds: 105 })
    }
    if (difficulty === 3) {
      const slope = int(rng, -6, 6) || 3
      const intercept = int(rng, -8, 8)
      const xs = [-1, 2, 5]
      const table = { caption: 'Selected values of f', headers: ['x', 'f(x)'], rows: xs.map((x) => [String(x), String(slope * x + intercept)]) }
      return numericQuestion({ seed, skillId, difficulty, format, table, prompt: 'The function f is linear. What is its rate of change?', answer: slope, distractors: [intercept, -slope, slope * 3], explanation: `Between consecutive rows, x increases by 3 and f(x) increases by ${3 * slope}. The rate of change is ${3 * slope}/3 = ${slope}.`, estimatedSeconds: 95 })
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
    if (difficulty === 3) {
      const adult = int(rng, 4, 10)
      const child = int(rng, 5, 12)
      const adultPrice = int(rng, 8, 14)
      const childPrice = int(rng, 3, 7)
      const count = adult + child
      const revenue = adult * adultPrice + child * childPrice
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A museum sold ${count} tickets. Adult tickets cost $${adultPrice}, child tickets cost $${childPrice}, and total ticket revenue was $${revenue}.`, prompt: 'How many adult tickets were sold?', answer: adult, distractors: [child, count, fraction(revenue, adultPrice)], explanation: `Let a and c be the adult and child ticket counts. Use a + c = ${count} and ${adultPrice}a + ${childPrice}c = ${revenue}. Substitution or elimination gives a = ${adult}.`, estimatedSeconds: 110 })
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
    if (difficulty === 3) {
      const existing = int(rng, 24, 48)
      const perRow = int(rng, 6, 10)
      const rows = int(rng, 7, 12)
      const minimum = existing + perRow * rows - int(rng, 0, perRow - 1)
      return conceptualQuestion(seed, skillId, difficulty, `A hall already has ${existing} seats. Each new row adds ${perRow} seats. The hall needs at least ${minimum} seats in total.`, 'If r is the number of new rows, which inequality models the requirement?', [`${existing} + ${perRow}r ≥ ${minimum}`, `${existing} + ${perRow}r ≤ ${minimum}`, `${perRow} + ${existing}r ≥ ${minimum}`, `${perRow}r - ${existing} ≥ ${minimum}`], 0, 'The existing seats plus the seats in r new rows must be greater than or equal to the minimum.', undefined, ['Supported', 'At least requires greater than or equal to', 'The fixed amount and per-row rate were exchanged', 'The existing seats should be added, not subtracted'])
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
    if (difficulty === 3) {
      const a = int(rng, 2, 6)
      const b = int(rng, 2, 8)
      const c = int(rng, 1, 5)
      const coefficient = b - a * c
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `(${a}x + ${b})(x - ${c})`, prompt: 'When the expression is expanded, what is the coefficient of x?', answer: coefficient, distractors: [a * c + b, a, -a * c], explanation: `The x-terms are -${a * c}x and ${b}x. Their coefficients add to ${b} - ${a * c} = ${coefficient}.`, estimatedSeconds: 95 })
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
    if (difficulty === 3) {
      const root = int(rng, 3, 9)
      const offset = int(rng, 2, 7)
      const constant = root ** 2 + offset
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `x² + ${offset} = ${constant}`, prompt: 'What is the positive solution to the equation?', answer: root, distractors: [-root, constant - offset, root + offset], explanation: `Subtract ${offset} to get x² = ${root ** 2}. The two solutions are ${root} and ${-root}; the positive solution is ${root}.`, estimatedSeconds: 90 })
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
    if (difficulty === 3) {
      const initial = int(rng, 80, 160)
      const ratio = pick(rng, [1.1, 1.2, 1.25])
      const years = 2
      const answer = Number((initial * ratio ** years).toFixed(2))
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A laboratory culture begins with ${initial} cells. Under fixed conditions, the number of cells is modeled by P(t) = ${initial}(${ratio})^t, where t is the number of hours after observation begins.`, prompt: `According to the model, how many cells are present after ${years} hours?`, answer, acceptedAnswers: [String(answer)], distractors: [initial + ratio * years, initial * ratio * years, initial * ratio], explanation: `Substitute t = ${years}: P(${years}) = ${initial}(${ratio})^${years} = ${answer}.`, estimatedSeconds: 95 })
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
    if (difficulty === 3) {
      const h = int(rng, -4, 5)
      const k = int(rng, 1, 7)
      const height = k + int(rng, 2, 8)
      return conceptualQuestion(seed, skillId, difficulty, `y = (x ${h >= 0 ? '-' : '+'} ${Math.abs(h)})² + ${k}\ny = ${height}`, 'How many solutions does the system have?', ['Two', 'One', 'None', 'Infinitely many'], 0, `The horizontal line y = ${height} lies above the parabola's minimum value ${k}, so it intersects the parabola at two points.`, undefined, ['Supported', 'One solution would require the line to pass through the vertex', 'A line above the minimum intersects the upward-opening parabola', 'A line and a parabola cannot be identical'])
    }
    const r1 = int(rng, -4, -1)
    const r2 = int(rng, 2, 6)
    const slope = r1 + r2
    const intercept = -r1 * r2
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `y = x²\ny = ${slope}x ${intercept >= 0 ? '+' : '-'} ${Math.abs(intercept)}`, prompt: 'What is the sum of the x-coordinates of the intersection points?', answer: slope, distractors: [intercept, r2 - r1, -slope], explanation: `Set the equations equal. The resulting quadratic has roots ${r1} and ${r2}, whose sum is ${slope}.` })
  }

  if (skillId === 'ratios-rates-units') {
    if (difficulty === 5) {
      const scale = pick(rng, [20, 25, 50])
      const modelVolume = pick(rng, [8, 12, 18])
      const actualCubicCentimeters = modelVolume * scale ** 3
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A solid architectural model is built at a linear scale of 1:${scale}. The model has a volume of ${modelVolume} cubic centimeters.`, prompt: 'What is the volume of the actual structure, in cubic centimeters?', answer: actualCubicCentimeters, distractors: [modelVolume * scale, modelVolume * scale ** 2, modelVolume + scale ** 3], explanation: `Volume scales by the cube of the linear factor. The actual volume is ${modelVolume}(${scale}³) = ${actualCubicCentimeters} cubic centimeters.`, estimatedSeconds: 125 })
    }
    if (difficulty >= 4) {
      const metersPerSecond = int(rng, 4, 12)
      const minutes = int(rng, 3, 9)
      const meters = metersPerSecond * minutes * 60
      const kilometers = meters / 1000
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A robotic cart travels at a constant speed of ${metersPerSecond} meters per second for ${minutes} minutes.`, prompt: 'How many kilometers does the cart travel?', answer: kilometers, acceptedAnswers: [String(kilometers), fraction(meters, 1000)], distractors: [metersPerSecond * minutes, meters, kilometers * 60], distractorReasons: { [String(metersPerSecond * minutes)]: 'Minutes were used with a per-second rate without converting time', [String(meters)]: 'The distance was left in meters instead of kilometers', [String(kilometers * 60)]: 'The time conversion was applied twice' }, explanation: `${minutes} minutes is ${minutes * 60} seconds. The distance is ${metersPerSecond} × ${minutes * 60} = ${meters} meters, or ${kilometers} kilometers.`, estimatedSeconds: 105 })
    }
    if (difficulty === 3) {
      const scale = int(rng, 3, 8)
      const centimeters = int(rng, 4, 12)
      const kilometers = scale * centimeters
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `On a map, 1 centimeter represents ${scale} kilometers. Two towns are ${centimeters} centimeters apart on the map.`, prompt: 'What is the actual distance between the towns, in meters?', answer: kilometers * 1000, distractors: [kilometers, centimeters * 1000, fraction(centimeters, scale)], explanation: `The map distance represents ${centimeters}(${scale}) = ${kilometers} kilometers. Multiply by 1,000 to convert kilometers to meters, giving ${kilometers * 1000}.`, estimatedSeconds: 100 })
    }
    const hours = int(rng, 2, 6)
    const rate = int(rng, 35, 75)
    const distance = hours * rate
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A train travels ${distance} kilometers at a constant speed in ${hours} hours.`, prompt: 'What is its speed in kilometers per hour?', answer: rate, distractors: [distance * hours, distance - hours, rate * 2], explanation: `Unit rate is distance divided by time: ${distance}/${hours} = ${rate} kilometers per hour.` })
  }

  if (skillId === 'percentages') {
    if (difficulty === 5) {
      const original = pick(rng, [125, 200, 320, 500])
      const rate = pick(rng, [10, 20, 25])
      const final = Number((original * (1 - rate / 100) ** 2).toFixed(2))
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `An equipment value decreases by the same percent at the end of each year. It falls from $${original} to $${final} after two years.`, prompt: 'By what percent does the value decrease each year?', answer: rate, distractors: [2 * rate, 100 - rate, Math.round((original - final) / original * 100)], explanation: `If r is the yearly decimal decrease, ${original}(1 - r)² = ${final}. Thus (1 - r)² = ${(final / original).toFixed(4)}, so 1 - r = ${1 - rate / 100} and r = ${rate}%.`, estimatedSeconds: 125 })
    }
    if (difficulty >= 4) {
      const increase = pick(rng, [20, 25, 40, 50])
      const original = pick(rng, [80, 120, 160, 200])
      const increased = original * (1 + increase / 100)
      const decrease = pick(rng, [10, 20, 25])
      const final = increased * (1 - decrease / 100)
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A quantity is increased by ${increase}% and then the resulting quantity is decreased by ${decrease}%. The final value is ${final}.`, prompt: 'What was the original value?', answer: original, distractors: [final, final / (1 + (increase - decrease) / 100), increased], explanation: `Let the original value be x. The changes multiply it by ${1 + increase / 100} and then by ${1 - decrease / 100}, so ${1 + increase / 100}(${1 - decrease / 100})x = ${final}. Solving gives x = ${original}.`, estimatedSeconds: 120 })
    }
    if (difficulty === 3) {
      const original = pick(rng, [80, 120, 160, 200])
      const percent = pick(rng, [20, 25, 40, 50])
      const final = original * (1 + percent / 100)
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `After a ${percent}% increase, the price of an item is $${final}.`, prompt: 'What was the price, in dollars, before the increase?', answer: original, distractors: [final - percent, final * (1 - percent / 100), final - original], explanation: `If x is the original price, then ${(1 + percent / 100)}x = ${final}. Dividing by ${1 + percent / 100} gives x = ${original}.`, estimatedSeconds: 100 })
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
    if (difficulty === 3) {
      const slope = int(rng, 2, 6)
      const intercept = int(rng, -5, 8)
      const xs = [1, 3, 5]
      const table = { caption: 'Selected values from a linear model', headers: ['x', 'y'], rows: xs.map((x) => [String(x), String(slope * x + intercept)]) }
      const targetX = 7
      const answer = slope * targetX + intercept
      return numericQuestion({ seed, skillId, difficulty, format, table, prompt: `The relationship is linear. Based on the table, what is the value of y when x = ${targetX}?`, answer, distractors: [slope, intercept, slope * 5 + intercept], explanation: `The table changes by ${2 * slope} in y whenever x changes by 2, so the slope is ${slope}. Continue the pattern to x = ${targetX}, giving y = ${answer}.`, estimatedSeconds: 100 })
    }
    const observed = int(rng, 20, 45)
    const residual = int(rng, -7, 8) || 4
    const predicted = observed - residual
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A line of best fit predicts ${predicted} units for an observation whose actual value is ${observed} units.`, prompt: 'What is the residual?', answer: residual, distractors: [-residual, predicted, observed + predicted], explanation: `Residual equals observed minus predicted: ${observed} - ${predicted} = ${residual}.` })
  }

  if (skillId === 'probability') {
    if (difficulty === 5) {
      const red = int(rng, 5, 9)
      const blue = int(rng, 4, 8)
      const total = red + blue
      const answer = fraction(red * (red - 1), total * (total - 1))
      return numericQuestion({ seed, skillId, difficulty, format, table: { caption: 'Tiles in a bag', headers: ['Color', 'Number'], rows: [['Red', String(red)], ['Blue', String(blue)]] }, stimulus: 'A bag contains the tiles shown in the table. Two tiles are selected at random without replacement.', prompt: 'What is the probability that both selected tiles are red?', answer, acceptedAnswers: [answer, String(red * (red - 1) / (total * (total - 1)))], distractors: [fraction(red * red, total * total), fraction(red, total), fraction(red * blue, total * (total - 1))], explanation: `The first red probability is ${red}/${total}; after a red tile is removed, the second is ${red - 1}/${total - 1}. Their product is ${answer}.`, estimatedSeconds: 120 })
    }
    if (difficulty >= 4) {
      const seniorTeam = int(rng, 8, 14)
      const seniorNot = int(rng, 5, 11)
      const juniorTeam = int(rng, 7, 13)
      const juniorNot = int(rng, 8, 15)
      const seniorTotal = seniorTeam + seniorNot
      const answer = fraction(seniorTeam, seniorTotal)
      return numericQuestion({ seed, skillId, difficulty, format, table: { caption: 'Club membership', headers: ['', 'Team leader', 'Not a team leader'], rows: [['Senior', String(seniorTeam), String(seniorNot)], ['Junior', String(juniorTeam), String(juniorNot)]] }, prompt: 'A senior is selected at random. What is the probability that the selected senior is a team leader?', answer, acceptedAnswers: [answer, String(seniorTeam / seniorTotal)], distractors: [fraction(seniorTeam, seniorTeam + seniorNot + juniorTeam + juniorNot), fraction(seniorTeam, seniorTeam + juniorTeam), fraction(seniorNot, seniorTotal)], explanation: `Because the student is known to be a senior, restrict the sample space to the ${seniorTotal} seniors. Of those, ${seniorTeam} are team leaders, so the probability is ${answer}.`, estimatedSeconds: 115 })
    }
    if (difficulty === 3) {
      const seniors = int(rng, 12, 20)
      const seniorLeaders = int(rng, 4, seniors - 3)
      const juniors = int(rng, 12, 22)
      const answer = fraction(seniorLeaders, seniors)
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A club has ${seniors} seniors and ${juniors} juniors. Of the seniors, ${seniorLeaders} are team leaders. A senior is selected at random.`, prompt: 'What is the probability that the selected senior is a team leader?', answer, acceptedAnswers: [answer, String(seniorLeaders / seniors)], distractors: [fraction(seniorLeaders, seniors + juniors), fraction(seniors - seniorLeaders, seniors), fraction(seniorLeaders, juniors)], explanation: `The condition limits the sample space to the ${seniors} seniors. Of those, ${seniorLeaders} are team leaders, so the probability is ${answer}.`, estimatedSeconds: 95 })
    }
    const group = int(rng, 18, 30)
    const favorable = int(rng, 3, Math.floor(group / 2))
    const answer = fraction(favorable, group)
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `Of ${group} students in a club, ${favorable} are both seniors and team leaders. A student is selected at random from the club.`, prompt: 'What is the probability that the selected student is both a senior and a team leader?', answer, acceptedAnswers: [answer, String(favorable / group)], distractors: [fraction(group - favorable, group), fraction(favorable, group - favorable), String(favorable)], explanation: `Use favorable outcomes over total outcomes: ${favorable}/${group}, which simplifies to ${answer}.` })
  }

  if (skillId === 'sampling-margin-error') {
    if (difficulty === 1) return conceptualQuestion(seed, skillId, difficulty, 'Two surveys use the same random sampling method. Survey A samples 200 voters, and Survey B samples 800 voters.', 'Which survey is expected to have the smaller margin of error?', ['Survey B', 'Survey A', 'They must have equal margins of error', 'The sample sizes provide no useful comparison'], 0, 'With the same sampling method and confidence level, the larger random sample is expected to have the smaller margin of error.')
    if (difficulty === 2) return conceptualQuestion(seed, skillId, difficulty, 'A city wants to estimate how often residents use public parks. Survey 1 randomly selects addresses from every district. Survey 2 places a voluntary survey link on the parks department website.', 'Which statement best compares the surveys?', ['Survey 1 is less vulnerable to voluntary-response bias.', 'Survey 2 is unbiased because anyone can open the link.', 'Survey 2 must have a smaller margin of error.', 'Survey 1 can prove that parks cause better health.'], 0, 'Random selection across the city is more representative than a voluntary website response, whose participants may be unusually interested in parks.')
    if (difficulty === 3) return conceptualQuestion(seed, skillId, difficulty, 'Two polls use the same random sampling method and confidence level. Poll A surveys 450 adults. Poll B surveys 1,800 adults.', 'Which statement is most likely true?', ['Poll B has a smaller margin of error.', 'Poll A is more representative solely because it is smaller.', 'Both polls must report the same estimate.', 'Poll B can establish a cause-and-effect relationship.'], 0, 'With the method and confidence level held constant, the larger sample generally has less sampling variability and a smaller margin of error.')
    if (difficulty === 4) return conceptualQuestion(seed, skillId, difficulty, 'A school surveys 2,000 students by selecting every participant from one optional after-school athletics program. The survey reports a margin of error of 2 percentage points for student exercise habits.', 'Which concern is most important when interpreting the result?', ['The large sample does not remove bias from selecting only athletics participants.', 'The stated margin of error proves the estimate is within 2 points of the truth.', 'A sample of 2,000 is too large to be useful.', 'Exercise habits cannot be studied with survey data.'], 0, 'Margin of error describes random sampling variability, not systematic selection bias. A large sample from one athletics program may still misrepresent the whole school.')
    return conceptualQuestion(seed, skillId, difficulty, 'A researcher wants to reduce the margin of error of a random-sample estimate while keeping the confidence level and sampling method unchanged.', 'Which change is most likely to accomplish this goal?', ['Increase the random sample from 600 people to 2,400 people.', 'Replace random selection with a voluntary online poll of 2,400 people.', 'Decrease the sample from 600 people to 150 people.', 'Keep 600 people but report more decimal places.'], 0, 'Increasing a genuinely random sample reduces sampling variability. Changing to voluntary response introduces bias, while fewer observations or extra decimal places do not improve precision.')
  }

  if (skillId === 'statistical-claims') {
    if (difficulty === 1) return conceptualQuestion(seed, skillId, difficulty, 'A study finds that students who sleep at least eight hours tend to earn higher test scores than students who sleep less. The researchers did not assign sleep schedules.', 'Which conclusion is best supported?', ['More sleep is associated with higher scores in this study.', 'Sleeping eight hours causes every student to score higher.', 'Higher scores cause students to sleep longer.', 'The study proves that no other variable affects scores.'], 0, 'Because the study was observational, it supports an association but not a cause-and-effect conclusion.')
    if (difficulty === 2) return conceptualQuestion(seed, skillId, difficulty, 'Researchers randomly assign volunteers to use either a standing desk or a seated desk for four weeks, then compare reported back discomfort.', 'Which conclusion is best supported by this design?', ['A difference in discomfort can be attributed to desk assignment for volunteers like those studied.', 'Standing desks reduce discomfort for every office worker.', 'The result can be generalized to all adults because assignment was random.', 'The study can show association only because no treatment was imposed.'], 0, 'Random assignment supports a causal comparison for the studied volunteers, but the volunteer sample does not justify a claim about every worker.')
    if (difficulty === 3) return conceptualQuestion(seed, skillId, difficulty, 'Researchers take a random sample of adults in a county and record each person’s weekly exercise and resting heart rate. They find that more exercise is associated with a lower resting heart rate.', 'Which conclusion is best supported?', ['The association can be generalized to adults in the county, but the study does not establish that exercise caused the difference.', 'Exercise caused the lower heart rates for every adult in the county.', 'The result cannot describe the county because no treatment was assigned.', 'Random sampling eliminates every possible confounding variable.'], 0, 'Random sampling supports generalization to the county population, but the observational design does not support a causal claim.')
    if (difficulty === 4) return conceptualQuestion(seed, skillId, difficulty, 'Researchers randomly sample patients from a large clinic, then randomly assign each sampled patient to receive either a new reminder system or the usual appointment notices. They compare missed appointments after three months.', 'Which conclusion is best supported if the new-system group misses fewer appointments?', ['The reminder system caused the reduction for patients like those at the clinic, and the result can reasonably generalize to that clinic population.', 'The result proves the system works for every patient in every country.', 'Only an association can be reported because the patients were sampled randomly.', 'The result can be generalized but cannot support a causal conclusion.'], 0, 'Random assignment supports a causal comparison, and random sampling from the clinic population supports generalization to that population, not to every patient everywhere.')
    return conceptualQuestion(seed, skillId, difficulty, 'In a randomized trial, 30% of participants assigned to the new treatment stop participating, compared with 4% assigned to the standard treatment. Among those who finish, the new-treatment group has better outcomes.', 'Which issue most directly limits a causal interpretation of the reported result?', ['The unequal dropout rates may make the remaining groups systematically different despite the original random assignment.', 'Random assignment can never support a causal conclusion.', 'A standard-treatment group prevents comparison with the new treatment.', 'Better outcomes among completers prove the treatment works for all participants.'], 0, 'Substantial unequal attrition can undo the comparability created by random assignment. The completers may differ for reasons connected to both treatment tolerance and outcome.')
  }

  if (skillId === 'area-volume') {
    if (difficulty === 5) {
      const radius = int(rng, 3, 7)
      const height = pick(rng, [9, 12, 15, 18])
      const coefficient = radius ** 2 * height / 3
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A right circular cone has radius ${radius} centimeters and volume ${coefficient}π cubic centimeters.`, prompt: 'What is the height, in centimeters, of the cone?', answer: height, distractors: [coefficient, radius * height, 3 * coefficient / radius], explanation: `Use V = (1/3)πr²h. Then ${coefficient}π = (1/3)π(${radius}²)h, so h = ${height}.`, estimatedSeconds: 120 })
    }
    if (difficulty >= 4) {
      const volume = pick(rng, [48, 72, 96, 120])
      const scale = pick(rng, [2, 3])
      const answer = volume * scale ** 3
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `Solid B is similar to solid A. Every linear dimension of solid B is ${scale} times the corresponding dimension of solid A. The volume of solid A is ${volume} cubic units.`, prompt: 'What is the volume, in cubic units, of solid B?', answer, distractors: [volume * scale, volume * scale ** 2, volume + scale ** 3], distractorReasons: { [String(volume * scale)]: 'The linear scale factor was applied directly to volume', [String(volume * scale ** 2)]: 'The area scale factor was used instead of the volume scale factor', [String(volume + scale ** 3)]: 'The scale factor was added rather than multiplied' }, explanation: `Volumes of similar solids scale by the cube of the linear factor. Therefore the volume is ${volume}(${scale}³) = ${answer}.`, estimatedSeconds: 110 })
    }
    if (difficulty === 3) {
      const length = int(rng, 5, 12)
      const width = int(rng, 3, 9)
      const height = int(rng, 4, 10)
      const volume = length * width * height
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A rectangular prism has a length of ${length} centimeters, a width of ${width} centimeters, and a volume of ${volume} cubic centimeters.`, prompt: 'What is the height, in centimeters, of the prism?', answer: height, distractors: [length * width, volume / length, volume / width], explanation: `For a rectangular prism, V = lwh. Therefore ${volume} = (${length})(${width})h, so h = ${volume}/${length * width} = ${height}.`, estimatedSeconds: 95 })
    }
    const radius = int(rng, 2, 7)
    const height = int(rng, 3, 10)
    const coefficient = radius * radius * height
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A right circular cylinder has radius ${radius} centimeters and height ${height} centimeters.`, prompt: 'What is its volume, in cubic centimeters, divided by π?', answer: coefficient, distractors: [2 * radius * height, radius * height, radius * radius + height], explanation: `V = πr²h = π(${radius}²)(${height}) = ${coefficient}π. Dividing by π gives ${coefficient}.` })
  }

  if (skillId === 'lines-angles-triangles') {
    if (difficulty === 5) {
      const small = int(rng, 4, 9)
      const scale = int(rng, 2, 5)
      const large = small * scale
      const matching = int(rng, 5, 11)
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `In triangle ABC, points D and E lie on sides AB and AC, respectively, and segment DE is parallel to segment BC. If AD = ${small}, AB = ${large}, and DE = ${matching},`, prompt: 'what is the length of BC?', answer: matching * scale, distractors: [matching + scale, matching * small, matching / scale], explanation: `Because DE is parallel to BC, triangles ADE and ABC are similar. The scale factor is AB/AD = ${large}/${small} = ${scale}, so BC = ${matching}(${scale}) = ${matching * scale}.`, estimatedSeconds: 125 })
    }
    if (difficulty >= 4) {
      const x = int(rng, 8, 16)
      const a1 = 2 * x + 4
      const a2 = 3 * x - 5
      const a3 = 180 - a1 - a2
      const constant = a3 - x
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `The angle measures of a triangle are (2x + 4)°, (3x - 5)°, and (x + ${constant})°.`, prompt: 'What is the measure, in degrees, of the largest angle?', answer: Math.max(a1, a2, a3), distractors: [x, a1, a3], explanation: `Set the sum of the three expressions equal to 180° to get x = ${x}. The angle measures are ${a1}°, ${a2}°, and ${a3}°, so the largest is ${Math.max(a1, a2, a3)}°.`, estimatedSeconds: 120 })
    }
    if (difficulty === 3) {
      const x = int(rng, 18, 34)
      const firstConstant = int(rng, 4, 12)
      const exterior = 3 * x + firstConstant
      const secondRemote = exterior - (x + firstConstant)
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `An exterior angle of a triangle measures (3x + ${firstConstant})°. Its two remote interior angles measure (x + ${firstConstant})° and ${secondRemote}°.`, prompt: 'What is the value of x?', answer: x, distractors: [secondRemote, exterior, x + firstConstant], explanation: `An exterior angle equals the sum of the two remote interior angles. Thus 3x + ${firstConstant} = x + ${firstConstant} + ${secondRemote}, which gives x = ${x}.`, estimatedSeconds: 100 })
    }
    const angle1 = int(rng, 35, 75)
    const angle2 = int(rng, 35, 75)
    const angle3 = 180 - angle1 - angle2
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `Two angles of a triangle measure ${angle1}° and ${angle2}°.` , prompt: 'What is the measure, in degrees, of the third angle?', answer: angle3, distractors: [angle1 + angle2, 360 - angle1 - angle2, Math.abs(angle1 - angle2)], explanation: `Triangle angles sum to 180°. The third angle is 180 - ${angle1} - ${angle2} = ${angle3}°.` })
  }

  if (skillId === 'right-triangle-trig') {
    if (difficulty === 5) {
      const distance = pick(rng, [20, 24, 28, 32])
      const eyeHeight = 2
      const rise = distance * 3 / 4
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `From a point ${distance} meters from the base of a vertical tower, the tangent of the angle of elevation from an observer's eye to the top is 3/4. The observer's eye is ${eyeHeight} meters above the ground.`, prompt: 'What is the height, in meters, of the tower?', answer: rise + eyeHeight, distractors: [rise, distance * 4 / 3 + eyeHeight, distance + eyeHeight], explanation: `The vertical rise above eye level is (${distance})(3/4) = ${rise} meters. Add the ${eyeHeight}-meter eye height to get ${rise + eyeHeight} meters.`, estimatedSeconds: 130 })
    }
    if (difficulty >= 4) {
      const scale = int(rng, 3, 9)
      const hypotenuse = 5 * scale
      const opposite = 3 * scale
      const adjacent = 4 * scale
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `In right triangle ABC, angle C is 90°. For angle A, sin A = 3/5. The hypotenuse AB has length ${hypotenuse}.`, prompt: 'What is the length of side AC?', answer: adjacent, distractors: [opposite, hypotenuse, fraction(3 * hypotenuse, 5)], distractorReasons: { [String(opposite)]: 'The side opposite angle A was found instead of the adjacent side AC', [String(hypotenuse)]: 'The given hypotenuse was reported without using the ratio' }, explanation: `sin A = opposite/hypotenuse = 3/5, so the side ratios form a 3-4-5 triangle. With hypotenuse ${hypotenuse}, the scale is ${scale}, and adjacent side AC = 4(${scale}) = ${adjacent}.`, estimatedSeconds: 110 })
    }
    if (difficulty === 3) {
      const scale = int(rng, 2, 8)
      const shorterLeg = 5 * scale
      const longerLeg = 12 * scale
      const hypotenuse = 13 * scale
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A right triangle has legs of length ${shorterLeg} and ${longerLeg}.`, prompt: 'What is the length of the hypotenuse?', answer: hypotenuse, distractors: [17 * scale, 12 * scale, 13], explanation: `By the Pythagorean theorem, the hypotenuse is √(${shorterLeg}² + ${longerLeg}²) = √${hypotenuse ** 2} = ${hypotenuse}.`, estimatedSeconds: 95 })
    }
    const scale = int(rng, 2, 7)
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `In a right triangle, relative to angle θ, the opposite side is ${3 * scale} and the adjacent side is ${4 * scale}.`, prompt: 'What is tan θ?', answer: '3/4', acceptedAnswers: ['3/4', '0.75'], distractors: ['4/3', '3/5', '4/5'], explanation: `tan θ = opposite/adjacent = ${3 * scale}/${4 * scale} = 3/4.` })
  }

  if (skillId === 'circles') {
    if (difficulty === 5) {
      const external = int(rng, 4, 9)
      const internal = int(rng, 5, 12)
      const tangentSquared = external * (external + internal)
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `From point P outside a circle, a secant intersects the circle first at A and then at B. The external segment PA has length ${external}, and the internal segment AB has length ${internal}. A tangent from P touches the circle at T.`, prompt: 'What is the value of PT²?', answer: tangentSquared, distractors: [external * internal, external + internal, (external + internal) ** 2], explanation: `By the tangent-secant theorem, PT² = PA · PB = ${external}(${external + internal}) = ${tangentSquared}.`, estimatedSeconds: 125 })
    }
    if (difficulty >= 4) {
      const h = int(rng, -6, 6)
      const k = int(rng, -6, 6)
      const radius = int(rng, 3, 9)
      const d = -2 * h
      const e = -2 * k
      const right = radius ** 2 - h ** 2 - k ** 2
      const signTerm = (coefficient: number, variable: string) => `${coefficient >= 0 ? '+' : '-'} ${Math.abs(coefficient)}${variable}`
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `x² + y² ${signTerm(d, 'x')} ${signTerm(e, 'y')} = ${right}`, prompt: 'What is the radius of the circle represented by the equation?', answer: radius, distractors: [radius ** 2, Math.abs(h), Math.abs(k)], explanation: `Complete the square in x and y. The equation becomes (x ${h >= 0 ? '-' : '+'} ${Math.abs(h)})² + (y ${k >= 0 ? '-' : '+'} ${Math.abs(k)})² = ${radius ** 2}, so the radius is ${radius}.`, estimatedSeconds: 115 })
    }
    if (difficulty === 3) {
      const radius = int(rng, 4, 10)
      const angle = pick(rng, [45, 60, 90, 120])
      const coefficient = fraction(angle * radius * radius, 360)
      return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A sector of a circle with radius ${radius} has a central angle of ${angle}°.` , prompt: 'What is the area of the sector divided by π?', answer: coefficient, acceptedAnswers: [coefficient, String((angle * radius * radius) / 360)], distractors: [fraction(angle * 2 * radius, 360), String(radius ** 2), String(angle / 360)], explanation: `Sector area is ${angle}/360 × π(${radius}²). Dividing by π gives ${coefficient}.`, estimatedSeconds: 100 })
    }
    const radius = int(rng, 3, 9)
    const angle = pick(rng, [60, 90, 120, 180])
    const coefficient = fraction(angle * 2 * radius, 360)
    return numericQuestion({ seed, skillId, difficulty, format, stimulus: `A circle has radius ${radius}. A central angle of ${angle}° intercepts an arc.`, prompt: 'What is the arc length divided by π?', answer: coefficient, acceptedAnswers: [coefficient, String((angle * 2 * radius) / 360)], distractors: [fraction(angle * radius * radius, 360), String(2 * radius), String(angle / 360)], explanation: `Arc length is ${angle}/360 × 2π(${radius}). Dividing by π gives ${coefficient}.` })
  }

  return generateMathQuestion('linear-equations-one-variable', difficulty, seed, format)
}
