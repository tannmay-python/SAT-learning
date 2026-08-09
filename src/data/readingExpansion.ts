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
    'The distinction matters because the researchers must describe what the evidence actually establishes, not merely repeat a familiar feature of the setting. The surrounding details make the writer’s evaluation precise.',
    'That qualification is important to the study’s interpretation: readers must separate a change in the evidence from a change in the object itself. The final word therefore describes the claim’s exact scope.',
  ],
  'text-structure-purpose': [
    'The order of the sentences is consequential. The first establishes a claim, assumption, or observation, while the next sentence supplies the evidence or qualification that tells readers how to interpret it.',
    'Taken together, the sentences show how the writer moves from a starting point to a more precise account. The later information does not stand alone; it changes the significance of what came before.',
  ],
  'cross-text-connections': [
    'Both authors are concerned with how evidence should be interpreted rather than with the topic in the abstract.',
    'One text supplies the initial explanation, while the other tests its scope by pointing to a condition the first account leaves less visible.',
    'The disagreement is therefore about the strength and limits of the conclusion, not necessarily about every observation in the first text.',
    'The second author can accept the evidence while offering a different explanation for its size, cause, or meaning.',
  ],
  'central-ideas-details': [
    'The example is useful because it connects the specific observation to the broader conclusion. It also preserves the uncertainty in the evidence, so the passage distinguishes a supported possibility from a claim that would be too broad.',
    'This finding matters beyond the individual case because it changes how researchers describe the process. The passage presents the result as evidence for a qualified interpretation, not as proof that every case behaves identically.',
  ],
  'command-evidence-textual': [
    'The relevant evidence is the detail that most directly supports the stated interpretation. Other details may be true, but they do not establish the precise relationship the question asks the reader to identify.',
    'A careful reader must distinguish evidence that illustrates the claim from evidence that merely shares its subject. The strongest choice connects the quoted or described detail to the conclusion without adding an unsupported assumption.',
  ],
  'command-evidence-quantitative': [
    'The researchers compared the observations under the same general conditions and treated the displayed values as measurements rather than as predictions. The pattern matters because it supports a limited conclusion about the relationship shown in the data.',
    'The display is one part of a larger investigation: the numbers make the comparison visible, while the surrounding description identifies what was measured and what the researchers are entitled to conclude from the pattern.',
  ],
  inferences: [
    'The comparison is informative because the researchers held the main alternatives as constant as possible. The result therefore supports a cautious inference about the factor that changed, while leaving broader explanations open for later study.',
    'Nothing in the passage establishes an absolute rule. Instead, the observations make one explanation more plausible than the alternatives described, which is why the conclusion must stay within the limits of the evidence.',
  ],
  boundaries: [
    'The field team recorded the warning after several storms had loosened material above the route, and the notice remained in place until the slope could be inspected again.',
    'The archive preserves the original notes alongside later annotations, allowing researchers to reconstruct how the observation was recorded and why it mattered at the time.',
    'The crew documented each change in the site log so that later visitors could distinguish the temporary condition from the route’s usual appearance.',
    'The comparison was repeated under similar conditions, giving the researchers a consistent record of the two results rather than a single unusual observation.',
  ],
  'form-structure-sense': [
    'The surrounding wording makes the intended comparison or reference clear. The correct form must preserve that meaning while also matching the number, tense, modifier, or parallel structure required by the sentence.',
    'A tempting alternative may sound familiar in isolation, but it changes the relationship among the sentence’s parts. The best choice is the one that keeps the construction precise when the full sentence is read aloud.',
  ],
  transitions: [
    'The transition is determined by the relationship between the two ideas, not by a repeated keyword. Readers should ask whether the second sentence contrasts, qualifies, illustrates, adds to, or follows from the first.',
    'The final sentence extends the local reasoning by showing what the relationship means for the broader discussion. A transition that merely sounds smooth but signals the wrong relationship would distort that movement.',
  ],
  'rhetorical-synthesis': [
    'The notes include both background and evidence, but the student’s goal determines which details belong in the final sentence. A successful choice selects the relevant facts and preserves the level of certainty supported by the notes.',
    'The strongest sentence is concise without becoming vague: it gives readers the relationship or result the goal calls for and leaves out details that would distract from that emphasis or overstate what the research shows.',
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
