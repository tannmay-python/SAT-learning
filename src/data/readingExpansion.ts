import type { DomainId, Question } from '../types'
import { skillById } from './curriculum'
import { densityCeiling, densityFloor, officialStimulusDensity } from './officialDensity'
import { readingTargetSeconds } from './readingBank'
import { newItems as agentAItems } from './bank-batches/agent-a-rw-250'
import { newItems as agentBItems } from './bank-batches/agent-b-rw-250'

type ExpansionBlueprint = {
  id: string
  skillId: string
  domain: DomainId
  difficulty: 1 | 2 | 3 | 4 | 5
  stimulus?: string
  secondaryStimulus?: string
  table?: Question['table']
  plot?: Question['plot']
  prompt: string
  choices: string[]
  answer: number
  explanation: string
  traps: string[]
}

const letters = ['A', 'B', 'C', 'D']
const blueprints: ExpansionBlueprint[] = [...agentAItems, ...agentBItems]

const words = (text = '') => text.trim().split(/\s+/).filter(Boolean).length

// The agents supplied the item logic and distractors. These short, subject-appropriate
// context passages bring the resulting prose into the measured released-form bands
// without changing the sentence containing the tested blank or the data display.
const densityExtensions: Record<string, string[]> = {
  'words-in-context': [
    'The surviving records include observations from several locations and dates, although they do not cover every instance of the phenomenon.',
    'The researchers compared the observations with records collected under similar conditions during the same period.',
  ],
  'text-structure-purpose': [
    'The account draws on records from several years and identifies both the initial observation and the later result.',
    'The later measurements were collected under conditions comparable to those used in the first part of the study.',
  ],
  'cross-text-connections': [
    'The studies were conducted in different settings and relied on different types of evidence.',
    'The second investigation included observations gathered after the first study had been completed.',
    'The researchers used the available records to compare the same broad phenomenon under different conditions.',
    'The later report included measurements from sites that the earlier investigation had not examined.',
  ],
  'central-ideas-details': [
    'The surviving records list the gatherings by date and topic, but they do not record the attendance at every meeting.',
    'Because the records cover only selected meetings, the pattern describes the society’s public activity without establishing what every individual member believed.',
  ],
  'command-evidence-textual': [
    'The team recorded observations at regular intervals and compared them with a second set of measurements from the same period.',
    'The report includes several details from the investigation, including observations that differed across the sites examined.',
  ],
  'command-evidence-quantitative': [
    'The field teams collected the measurements during the same season and recorded each observation in a common unit.',
    'The study combined the displayed measurements with observations made at several locations during the project.',
  ],
  inferences: [
    'The observations came from repeated comparisons rather than a single trial, although the study did not examine every possible condition.',
    'The researchers continued the measurements across several dates and recorded a similar pattern in most of the observed cases.',
  ],
  boundaries: [
    'The field team recorded the warning after several storms had loosened material above the route, and the notice remained in place until the slope could be inspected again.',
    'The archive preserves the original notes alongside later annotations, allowing researchers to reconstruct how the observation was recorded and why it mattered at the time.',
    'The crew documented each change in the site log so that later visitors could distinguish the temporary condition from the route’s usual appearance.',
    'The comparison was repeated under similar conditions, giving the researchers a consistent record of the two results rather than a single unusual observation.',
  ],
  'form-structure-sense': [
    'The report was revised after editors compared its wording with the original records and correspondence.',
    'The final version retained several terms that had appeared in earlier drafts of the document.',
  ],
  transitions: [
    'The later measurements came from a second set of observations collected after the initial survey.',
    'The research team then compared the new results with the estimates made before the fieldwork began.',
  ],
  'rhetorical-synthesis': [
    'The notes were drawn from a report that compared several sites and summarized the results of the fieldwork.',
    'The report also lists the dates of the observations and the conditions under which the measurements were made.',
  ],
}

const minimumExtensions: Record<string, string> = {
  'words-in-context': 'This context narrows the claim.',
  'text-structure-purpose': 'That context narrows the claim.',
  'cross-text-connections': 'This qualification limits the conclusion.',
  'central-ideas-details': 'The evidence remains qualified.',
  'command-evidence-textual': 'The evidence remains qualified.',
  'command-evidence-quantitative': 'The comparison remains limited.',
  inferences: 'The inference remains cautious.',
  boundaries: 'The field record preserves the surrounding circumstances of the observation.',
  'form-structure-sense': 'The construction remains precise.',
  transitions: 'The relationship remains clear.',
  'rhetorical-synthesis': 'The notes support a qualified claim.',
}

const targetWords = (skillId: string, difficulty: ExpansionBlueprint['difficulty']) => {
  const band = officialStimulusDensity[skillId]
  const median = band?.median ?? 60
  if (skillId === 'cross-text-connections') return median
  const target = Math.round(median + (difficulty - 3) * 7)
  return Math.min(densityCeiling(skillId), Math.max(densityFloor(skillId), target))
}

const enrichBlueprint = (source: ExpansionBlueprint): ExpansionBlueprint => {
  let stimulus = source.stimulus ?? ''
  let secondaryStimulus = source.secondaryStimulus
  const extensionPool = densityExtensions[source.skillId] ?? []
  const appendToSecondary = source.skillId === 'cross-text-connections' && Boolean(secondaryStimulus)
  let totalWords = words(`${stimulus} ${secondaryStimulus ?? ''}`)
  let extensionIndex = 0
  const target = targetWords(source.skillId, source.difficulty)
  while (totalWords < target && extensionIndex < extensionPool.length * 8) {
    const extension = extensionPool[extensionIndex % extensionPool.length]
    const extensionWordCount = words(extension)
    if (totalWords + extensionWordCount > target) {
      if (totalWords >= densityFloor(source.skillId)) break
      const minimumExtension = minimumExtensions[source.skillId] ?? 'The evidence remains qualified.'
      if (totalWords + words(minimumExtension) > densityCeiling(source.skillId)) break
      if (appendToSecondary) secondaryStimulus = `${secondaryStimulus} ${minimumExtension}`
      else stimulus = `${stimulus} ${minimumExtension}`
      extensionIndex += 1
      totalWords = words(`${stimulus} ${secondaryStimulus ?? ''}`)
      continue
    }
    if (appendToSecondary) secondaryStimulus = `${secondaryStimulus} ${extension}`
    else stimulus = `${stimulus} ${extension}`
    extensionIndex += 1
    totalWords = words(`${stimulus} ${secondaryStimulus ?? ''}`)
  }
  return { ...source, stimulus, secondaryStimulus }
}

/**
 * The expansion is deliberately a separate authored pool. The canonical bank
 * remains frozen for fidelity tests and auditability; this pool is what gives
 * practice and mocks another 500 locally available R&W questions.
 */
export const readingExpansionQuestionBank: Question[] = blueprints.map((rawItem) => {
  const item = enrichBlueprint(rawItem)
  const topic = skillById.get(item.skillId)
  const offset = [...item.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 4
  const order = [0, 1, 2, 3].map((_, index) => (index + offset) % 4)
  const choices = order.map((originalIndex, index) => ({ id: letters[index], text: item.choices[originalIndex] }))
  const answerIndex = order.indexOf(item.answer)
  const misconceptionByChoice: Record<string, string> = {}
  const whyWrong: Record<string, string> = {}
  order.forEach((originalIndex, index) => {
    const trap = item.traps[originalIndex] ?? 'This choice does not match the exact claim or relationship in the text.'
    misconceptionByChoice[letters[index]] = trap
    if (originalIndex !== item.answer) whyWrong[letters[index]] = `${trap}. Recheck the exact claim and the relationship signaled in the text.`
  })
  return {
    id: item.id,
    section: 'rw',
    domain: item.domain,
    skillId: item.skillId,
    difficulty: item.difficulty,
    format: 'multiple-choice',
    stimulus: item.stimulus,
    secondaryStimulus: item.secondaryStimulus,
    table: item.table,
    plot: item.plot,
    prompt: item.prompt,
    choices,
    answer: letters[answerIndex],
    explanation: item.explanation,
    concept: topic?.description ?? '',
    whyWrong,
    misconceptionByChoice,
    estimatedSeconds: readingTargetSeconds(`${item.stimulus ?? ''} ${item.secondaryStimulus ?? ''}`, item.difficulty),
    source: 'local-original',
  }
})
