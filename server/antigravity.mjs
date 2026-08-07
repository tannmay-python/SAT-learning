import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { getEvidence, hasReport, saveAnalysis, saveGeneratedQuestions, saveLearnerModel, saveReport } from './store.mjs'
import officialDensity from './official-density.json' with { type: 'json' }

const execFileAsync = promisify(execFile)
const serverDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(serverDirectory, '..')
const schemaDirectory = resolve(serverDirectory, 'schemas')
const agyBinary = process.env.ANTIGRAVITY_CLI || resolve(homedir(), '.local/bin/agy')
const observerModel = process.env.SATLAS_OBSERVER_MODEL || 'gemini-3.6-flash-high'
const sessionModel = process.env.SATLAS_SESSION_MODEL || 'gemini-3.6-flash-high'
const reportModel = process.env.SATLAS_REPORT_MODEL || 'gemini-3.6-flash-high'
const generationModel = process.env.SATLAS_GENERATION_MODEL || 'gemini-3.6-flash-high'
const promptVersion = 'satlas-analyst-v4'

const runtime = {
  state: existsSync(agyBinary) ? 'idle' : 'offline',
  queued: 0,
  activeTask: undefined,
  lastCompletedAt: undefined,
  lastError: existsSync(agyBinary) ? undefined : `Antigravity CLI was not found at ${agyBinary}`,
}
let workChain = Promise.resolve()
let resetRevision = 0
const queuedAttemptIds = new Set()
const queuedReportIds = new Set()

export function invalidateAiWork() {
  resetRevision += 1
}

export function getAiStatus() {
  return {
    available: existsSync(agyBinary),
    provider: 'Google Antigravity',
    access: 'Google AI Pro subscription via local OAuth',
    observerModel,
    reportModel,
    generationModel,
    ...runtime,
  }
}

function enqueue(label, work) {
  runtime.queued += 1
  const task = workChain.catch(() => undefined).then(async () => {
    runtime.queued -= 1
    runtime.state = 'working'
    runtime.activeTask = label
    runtime.lastError = undefined
    try {
      const value = await work()
      runtime.lastCompletedAt = new Date().toISOString()
      runtime.state = 'idle'
      return value
    } catch (error) {
      runtime.state = 'error'
      runtime.lastError = error instanceof Error ? error.message : String(error)
      console.error(`Antigravity task failed (${label}):`, error)
      throw error
    } finally {
      runtime.activeTask = undefined
    }
  })
  workChain = task
  return task
}

async function runStructured({ prompt, schema, model, effort = 'low', timeout = '2m' }) {
  if (!existsSync(agyBinary)) throw new Error('Antigravity CLI is not installed.')
  const args = [
    '--print', prompt,
    '--output-format', 'json',
    '--json-schema', resolve(schemaDirectory, schema),
    '--model', model,
    '--effort', effort,
    '--mode', 'plan',
    '--sandbox',
    '--disable-slash-commands',
    '--print-timeout', timeout,
  ]
  const { stdout } = await execFileAsync(agyBinary, args, {
    cwd: projectRoot,
    timeout: 180_000,
    maxBuffer: 12 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1' },
  })
  const envelope = JSON.parse(stdout.trim())
  if (envelope.status && String(envelope.status).toLowerCase() !== 'success') throw new Error(envelope.error || `Antigravity returned ${envelope.status}.`)
  const structured = envelope.structured_output ?? envelope.structuredOutput
  if (!structured) throw new Error('Antigravity returned no structured analysis.')
  return typeof structured === 'string' ? JSON.parse(structured) : structured
}

function compactAttempt(record) {
  const question = record.questionSnapshot
  return {
    id: record.id,
    sessionId: record.sessionId,
    createdAt: record.createdAt,
    section: record.section,
    domain: record.domain,
    skillId: record.skillId,
    difficulty: record.difficulty,
    response: record.response,
    correct: record.correct,
    ...(record.confidence ? { confidence: record.confidence } : {}),
    elapsedSeconds: Math.round(record.elapsedMs / 1000),
    usedHint: record.usedHint,
    reasoningNote: record.reasoningNote || null,
    likelyTrap: record.mistakeType || null,
    question: question ? {
      prompt: question.prompt,
      stimulus: question.stimulus,
      choices: question.choices,
      answer: question.answer,
      explanation: question.explanation,
      concept: question.concept,
      estimatedSeconds: question.estimatedSeconds,
    } : undefined,
  }
}

function withTimestamp(model) {
  return { ...model, updatedAt: new Date().toISOString() }
}

const readingSkills = new Set([
  'words-in-context', 'text-structure-purpose', 'cross-text-connections', 'central-ideas-details', 'command-evidence-textual',
  'command-evidence-quantitative', 'inferences', 'boundaries', 'form-structure-sense', 'rhetorical-synthesis', 'transitions',
])

const words = (value = '') => value.trim().split(/\s+/).filter(Boolean).length

/**
 * Models reach for markdown emphasis even when told not to. Official items are
 * plain prose, and the renderer shows text verbatim, so stray asterisks and
 * underscores would appear on screen as themselves. Stripping is preferable to
 * rejecting an otherwise sound batch.
 */
export function plainProse(value = '') {
  return String(value)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Rotates each item's choices so the key is spread across A-D. The reviewer
 * solved the item from the choice text, not its letter, so reordering cannot
 * change which choice is correct; the per-letter diagnoses move with their text.
 */
/**
 * The model writes its explanation in prose that names letters directly
 * ("Choice C is correct because..."), using whichever letters it assigned
 * before this rebalance. Rewriting the choice array without also rewriting
 * those mentions leaves prose that names the wrong letter throughout -- the
 * scored answer is still correct, but the displayed reasoning is not. Each
 * match is remapped independently via the old-to-new letter table, so a
 * permutation (old C becomes new A, old A becomes new B, ...) cannot cascade
 * into a second, incorrect substitution the way a sequential find-replace would.
 */
export function remapChoiceReferences(text, oldToNew) {
  if (!text) return text
  return String(text).replace(/\b([Cc]hoice)\s+([A-D])\b/g, (match, word, letter) => {
    const mapped = oldToNew[letter]
    return mapped ? `${word} ${mapped}` : match
  })
}

export function rebalanceAnswerPositions(questions) {
  const ids = ['A', 'B', 'C', 'D']
  return questions.map((question, index) => {
    const correct = question.choices.find((choice) => choice.id === question.answer)
    if (!correct) return question
    const others = question.choices.filter((choice) => choice.id !== question.answer)
    const target = index % 4
    const ordered = [...others.slice(0, target), correct, ...others.slice(target)]
    const oldToNew = Object.fromEntries(ordered.map((choice, position) => [choice.id, ids[position]]))
    const whyWrong = {}
    const misconceptionByChoice = {}
    const choices = ordered.map((choice, position) => {
      if (choice !== correct) {
        const reason = question.misconceptionByChoice?.[choice.id] ?? question.whyWrong?.[choice.id]
        if (reason) {
          const remapped = remapChoiceReferences(reason, oldToNew)
          whyWrong[ids[position]] = remapped
          misconceptionByChoice[ids[position]] = remapped
        }
      }
      return { id: ids[position], text: choice.text }
    })
    return {
      ...question,
      choices,
      answer: ids[target],
      whyWrong,
      misconceptionByChoice,
      explanation: remapChoiceReferences(question.explanation, oldToNew),
      concept: remapChoiceReferences(question.concept, oldToNew),
    }
  })
}

/**
 * Passage length bounds taken from the measured official forms rather than from
 * intuition. Easy items may sit at the official 25th percentile; Difficulty 4-5
 * items must reach the official median, because on the real test the harder
 * items of a type are the longer ones. The ceiling sits just above the official
 * 95th percentile so generation can produce the long tail the test actually has.
 */
function passageBounds(skillId, difficulty) {
  const band = officialDensity.bands[skillId]
  if (!band) return { min: difficulty >= 4 ? 75 : 60, max: 190 }
  return {
    min: difficulty >= 4 ? band.median : difficulty === 3 ? Math.round((band.p25 + band.median) / 2) : band.p25,
    max: Math.round(band.p95 * 1.12),
  }
}

const boundsLine = (skillId, label) => {
  const band = officialDensity.bands[skillId]
  return `${label}: ${band.p25}-${Math.round(band.p95 * 1.12)} words, typical ${band.median}`
}

/**
 * The single number the model is asked to hit for one item. Undershooting the
 * floor was the most common first-pass failure once bounds were raised to
 * official density, so the target sits with real margin above the floor
 * rather than at its edge -- a model that runs a little short still lands
 * inside the range instead of needing a repair round.
 */
function passageTargetWords(skillId, difficulty) {
  const bounds = passageBounds(skillId, difficulty)
  return Math.min(bounds.max - 10, Math.round(bounds.min * 1.18))
}

const BLANK = /_{2,}/
/** Skills whose official form is a passage with a blank the choices fill. */
const blankSkills = new Set(['boundaries', 'form-structure-sense', 'transitions', 'words-in-context', 'inferences'])

/**
 * A blank item has to still read correctly once a choice is dropped into it.
 * The generator's characteristic failure is leaving the word in the passage AND
 * repeating it in every choice, which yields "for decades decades; their
 * subterranean design" — sound by every other check and plainly broken to read.
 * Returns a reason string, or null when the item is fine.
 */
export function blankConventionFault(raw) {
  const stimulus = String(raw.stimulus || '')
  const blanks = stimulus.match(/_{2,}/g) || []
  if (blankSkills.has(raw.skillId) && blanks.length === 0) return 'the passage has no ____ blank for the choices to fill'
  if (blanks.length === 0) return null
  if (blanks.length > 1) return 'the passage has more than one blank'
  for (const choice of raw.choices) {
    const filled = stimulus.replace(BLANK, String(choice.text || '')).replace(/\s+/g, ' ')
    const repeat = filled.match(/\b([A-Za-z]{3,})\b[\s,;:]+\1\b/i)
    if (repeat) return `choice ${choice.id} repeats "${repeat[1]}", which the passage already supplies next to the blank`
  }
  return null
}

/**
 * Returns why an item was rejected, or null when it is sound. Separated from
 * the builder so a failed batch can tell the model exactly what to repair
 * instead of silently falling back to the authored bank.
 */
export function validationFault(raw, blueprint) {
  if (!raw || raw.section !== 'rw' || !readingSkills.has(raw.skillId)) return 'not a recognised Reading and Writing skill'
  if (raw.skillId !== blueprint.skillId || raw.domain !== blueprint.domain || raw.difficulty !== blueprint.difficulty) {
    return `does not match the requested blueprint (wanted ${blueprint.skillId} at difficulty ${blueprint.difficulty})`
  }
  if (!Array.isArray(raw.choices) || raw.choices.length !== 4) return 'does not have exactly four choices'
  const choiceIds = raw.choices.map((choice) => choice?.id)
  const choiceTexts = raw.choices.map((choice) => String(choice?.text || '').trim())
  if (new Set(choiceIds).size !== 4 || !['A', 'B', 'C', 'D'].every((id) => choiceIds.includes(id))) return 'choice ids are not exactly A, B, C, D'
  if (new Set(choiceTexts.map((text) => text.toLowerCase())).size !== 4 || choiceTexts.some((text) => text.length < 1)) return 'two choices are identical or empty'
  if (!choiceIds.includes(raw.answer)) return 'the answer does not name one of the choices'
  if (String(raw.prompt || '').trim().length < 12) return 'the prompt is missing or too short'
  if (String(raw.explanation || '').trim().length < 35) return 'the explanation is missing or too short'
  const totalStimulusWords = words(`${raw.stimulus || ''} ${raw.secondaryStimulus || ''}`)
  const bounds = passageBounds(raw.skillId, raw.difficulty)
  if (totalStimulusWords < bounds.min) return `the passage is ${totalStimulusWords} words but official items of this type run ${bounds.min}-${bounds.max}; it must be lengthened`
  if (totalStimulusWords > bounds.max) return `the passage is ${totalStimulusWords} words, above the ${bounds.max}-word official ceiling for this type`
  if (raw.skillId === 'cross-text-connections' && (words(raw.stimulus) < 45 || words(raw.secondaryStimulus) < 45)) return 'each of Text 1 and Text 2 must reach 45 words'
  if (raw.skillId === 'command-evidence-quantitative' && !raw.table) return 'a quantitative-evidence item must include a table'
  if (raw.table && (!Array.isArray(raw.table.headers) || !Array.isArray(raw.table.rows) || raw.table.rows.some((row) => row.length !== raw.table.headers.length))) {
    return 'the table rows do not line up with its headers'
  }
  return blankConventionFault(raw)
}

export function validateGeneratedReadingQuestion(raw, blueprint) {
  if (validationFault(raw, blueprint)) return null
  const whyWrong = {}
  const misconceptionByChoice = {}
  for (const choice of raw.choices) {
    if (choice.id === raw.answer) continue
    const reason = plainProse(raw.misconceptionByChoice?.[choice.id] || raw.whyWrong?.[choice.id]) || 'This choice is not supported by the passage.'
    misconceptionByChoice[choice.id] = reason
    whyWrong[choice.id] = reason
  }
  return {
    id: `ai-rw-${randomUUID()}`,
    section: 'rw',
    domain: raw.domain,
    skillId: raw.skillId,
    difficulty: raw.difficulty,
    format: 'multiple-choice',
    stimulus: plainProse(raw.stimulus),
    ...(raw.secondaryStimulus ? { secondaryStimulus: plainProse(raw.secondaryStimulus) } : {}),
    ...(raw.table ? { table: raw.table } : {}),
    prompt: plainProse(raw.prompt),
    choices: raw.choices.map((choice) => ({ id: choice.id, text: plainProse(choice.text) })),
    answer: raw.answer,
    explanation: plainProse(raw.explanation),
    concept: plainProse(raw.concept) || 'Use only the evidence and logical relationship supplied in the question.',
    whyWrong,
    misconceptionByChoice,
    estimatedSeconds: Math.max(40, Math.min(120, Math.round(Number(raw.estimatedSeconds) || 75))),
    source: 'ai-generated',
    createdAt: new Date().toISOString(),
    validationStatus: 'accepted',
  }
}

const normalizedTokens = (value = '') => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((token) => token.length > 1)

function shingleOverlap(left, right, size = 5) {
  const shingles = (value) => {
    const tokens = normalizedTokens(value)
    return new Set(Array.from({ length: Math.max(0, tokens.length - size + 1) }, (_, index) => tokens.slice(index, index + size).join(' ')))
  }
  const a = shingles(left); const b = shingles(right)
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const item of a) if (b.has(item)) shared += 1
  return shared / Math.min(a.size, b.size)
}

function readingText(question) {
  return `${question?.stimulus || ''} ${question?.secondaryStimulus || ''}`.trim()
}

export function hasSuspiciousReadingOverlap(question, references) {
  const source = readingText(question)
  return references.some((reference) => shingleOverlap(source, readingText(reference)) >= 0.42)
}

export function applyGenerationReviews(questions, reviews) {
  return questions.filter((question, index) => {
    const review = reviews.find((item) => item?.index === index)
    return review?.verdict === 'accept' && review.uniqueAnswer === true && review.solvedAnswer === question.answer
  })
}

export function queueAdaptiveQuestionGeneration(blueprint) {
  const cleanBlueprint = blueprint.filter((item) => item?.section === 'rw' && readingSkills.has(item.skillId)).slice(0, 12)
  if (!cleanBlueprint.length) return Promise.reject(new Error('No valid Reading and Writing question blueprint was supplied.'))
  return enqueue(`preparing ${cleanBlueprint.length} fresh question${cleanBlueprint.length === 1 ? '' : 's'}`, async () => {
    const evidence = await getEvidence()
    const recent = evidence.attempts.slice(-40).map((attempt) => ({
      skillId: attempt.skillId,
      difficulty: attempt.difficulty,
      correct: attempt.correct,
      likelyTrap: attempt.mistakeType || null,
      priorPrompt: attempt.questionSnapshot?.prompt,
      priorStimulusOpening: attempt.questionSnapshot?.stimulus?.slice(0, 180),
    }))
    // A per-item literal target is easier for the model to hit than a range
    // it has to interpret; this is what actually fixed the undershoot problem,
    // not the range alone.
    const blueprintWithTargets = cleanBlueprint.map((entry) => ({ ...entry, targetWords: passageTargetWords(entry.skillId, entry.difficulty) }))
    const prompt = `Create exactly ${cleanBlueprint.length} original digital SAT Reading and Writing questions, one for each blueprint entry and in the same order.

QUESTION BLUEPRINT
${JSON.stringify(blueprintWithTargets, null, 2)}

Each entry's targetWords is a literal word count for that item's stimulus (both texts combined for Cross-Text Connections). Write to within about 10 words of it. This is not a suggestion: undershooting it is the most common reason a fresh item gets bounced back for a rewrite.

TWO ORIGINAL, ALREADY-VETTED EXAMPLES AT THE RIGHT DENSITY (calibration only, do not reuse their content, names, or context)

Command of Textual Evidence, Difficulty 3, 98 words:
"The Havenport Courier began in 1851 as a four-page weekly serving dockworkers and merchants, and its earliest circulation ledgers list only subscribers living within walking distance of the harbor. Those ledgers break off in 1869, which has made the paper's later reach difficult to establish from the newspaper's own records. Historian Amara Oyelaran has instead assembled indirect sources from the following two decades, among them freight manifests, a printer's invoices for paper stock, and family correspondence held in the surrounding countryside. On the basis of this material she argues that the Courier reached readers well beyond the city itself by the 1880s."
Prompt: "Which finding would most directly support the historian's argument?"
Notice the shape: an institution and a limitation of the direct record, then a named researcher's method and claim built from indirect evidence. That structure is what makes the passage long without padding.

Inferences, Difficulty 3, blank format, 91 words:
"In a memory task, participants recalled word pairs equally well in silence and with steady background noise that held constant in volume and pitch throughout each trial. Recall declined only when the background instead contained changing speech, with sentences that shifted in topic and speaker every few seconds. A separate control condition ruled out fatigue by running the silence and steady-noise trials at matched points across the session. These patterns suggest that recall in this task ______"
(Note: the blank sits at the end after a full multi-sentence setup, not after one clause.)

CURRENT LEARNER MODEL
${JSON.stringify(evidence.learnerModel, null, 2)}

RECENT PERFORMANCE AND PRIOR ITEM OPENINGS (use for adaptation and duplicate avoidance)
${JSON.stringify(recent, null, 2)}

RECENT REQUESTED REASONING REVIEWS
${JSON.stringify(evidence.analyses.slice(-10).map((analysis) => {
  const attempt = evidence.attempts.find((item) => item.id === analysis.attemptId)
  return { skillId: attempt?.skillId, difficulty: attempt?.difficulty, verdict: analysis.verdict, gaps: analysis.gaps, nextMove: analysis.nextMove }
}), null, 2)}

Fidelity and originality requirements:
- These must be new questions, not reconstructions, paraphrases, or continuations of released College Board items. Do not mention SATLAS, Gemini, the learner, or this prompt inside an item.
- Match the digital SAT's self-contained one-question-per-passage format, restrained academic tone, four plausible choices, and exact skill named in each blueprint.
- Use varied humanities, literature, history, social-science, and natural-science contexts. Do not reuse a context or named researcher across this set.
- Hit each item's targetWords from the blueprint above. If a Command of Evidence or Inferences item comes up short, the fix is almost always that it is a one-sentence claim followed by four findings; the real form is a full paragraph that establishes a researcher, a question, a method, and a result, and only then poses the claim to be supported or completed. Write that paragraph rather than padding with adjectives.
- Cross-Text Connections must include two independently substantive texts totaling ${officialDensity.bands['cross-text-connections'].p25}-${Math.round(officialDensity.bands['cross-text-connections'].p95 * 1.12)} words with at least 45 words in each; put Text 1 in stimulus and Text 2 in secondaryStimulus.
- Command of Quantitative Evidence must include a compact table whose rows align with its headers, plus prose that introduces the study and the claim. The passage and table must both be needed.
- Difficulty 1 tests one direct move. Difficulty 2 uses a credible but visible trap. Difficulty 3 requires a careful relationship or two linked moves. Difficulty 4 uses tighter distinctions and denser evidence. Difficulty 5 requires precise synthesis or rejection of a highly plausible overclaim. Do not fake difficulty with rare vocabulary alone.
- Words in Context, Transitions, Boundaries, Form Structure and Sense, and Inferences items are written as a passage containing exactly one ____ blank. The blank REPLACES the text the choices supply; that text must not also sit beside the blank in the passage. Writing "provided freshwater for decades ____ their design protected the supply" alongside a choice of "decades;" is wrong, because it reads back as "for decades decades; their design". Write "provided freshwater for ____ their design protected the supply" so each choice supplies the word together with its punctuation.
- Spread the correct answer across positions. Over the whole set the key must not sit on the same letter more than twice, and never on the same letter three times in a row.
- Write plain prose. No markdown, asterisks, underscores, or italic markers anywhere in a stimulus, prompt, or choice; write species and title names as plain text. Name researchers by role and name in the official register ("marine ecologist Clara Vance"), not with an academic title.
- Do not open every item the same way. At most one item in this set may open with "[Field] [role] [Name] ...". Vary openings across the set: some can start with the phenomenon or finding itself, some with an institution or historical moment, some with a direct claim that the rest of the passage supports or complicates. A batch that reads like the same template with the nouns swapped is a fidelity failure even if every individual item passes every other check.
- Before writing the choices, decide the four choices' roles: the correct answer, and three specific, distinct error types the wrong choices will embody. Do not let two wrong choices encode the same kind of error. Draw from this taxonomy and name (privately, in your own reasoning) which one each distractor uses:
  reversal (states the opposite of what the text supports); scope shift (true of part of the evidence but overstated to the whole, or vice versa); right-idea-wrong-mechanism (correct outcome, wrong cause or process); plausible-but-unstated (a reasonable-sounding claim the passage never actually makes); off-target (answers a nearby but different question than the one asked); overclaim (goes further than the evidence licenses, e.g. proves vs suggests, always vs sometimes, causes vs is associated with).
  Then solve the item yourself from the finished text, independent of which choice you intended as correct. There must be exactly one choice that survives your independent solve. If two survive, the two distractors are too similar in strength or share an error type; rewrite one of them before moving on, not after.
- Each wrong choice must be rejected by the supplied text, table, or grammar rule -- never by outside knowledge or by being obviously silly. A distractor a learner could eliminate without reading the passage is not testing anything.
- Keep all evidence needed to answer inside the item. Do not require outside facts. Avoid political persuasion, distressing content, and culturally narrow assumptions.
- explanation must state why the answer follows and why the central trap fails. concept must name a reusable SAT method in plain language.
- whyWrong and misconceptionByChoice should map each wrong answer letter to a concise diagnosis naming its specific error type from the taxonomy above, not a generic "not supported by the passage."
- Return only the structured questions.`
    const generated = await runStructured({ prompt, schema: 'generated-reading-set.json', model: generationModel, effort: 'high', timeout: '3m' })

    // Items are kept or repaired individually. Rejecting the whole batch over
    // one out-of-range passage is what made fresh questions feel unreliable:
    // a single stray item sent the entire set back to the authored bank.
    const slots = cleanBlueprint.map((entry, index) => ({
      entry,
      question: validateGeneratedReadingQuestion(generated.questions?.[index], entry),
      fault: validationFault(generated.questions?.[index], entry),
    }))

    const broken = slots.filter((slot) => !slot.question)
    if (broken.length) {
      console.warn(`Antigravity generation: repairing ${broken.length} of ${slots.length} items — ${broken.map((slot) => `${slot.entry.skillId}: ${slot.fault}`).join('; ')}`)
      const repairPrompt = `${broken.length} of the questions you just wrote were rejected by an automatic fidelity check. Rewrite only those, keeping everything that was already correct about them and fixing exactly the stated problem. Return them in the order listed, one per entry.

REJECTED ITEMS AND THE REASON EACH FAILED
${JSON.stringify(broken.map((slot, index) => ({ index, blueprint: slot.entry, reason: slot.fault })), null, 2)}

The same fidelity contract as before still applies, and the passage-length ranges are binding:
${boundsLine(broken[0].entry.skillId, 'for example, this type')}

If the reason mentions a blank: the passage must contain exactly one ____ blank, and the word the choices supply must NOT also appear beside the blank in the passage. Writing "for decades ____ their design" with a choice of "decades;" is wrong, because it reads "for decades decades; their design". The passage must read "for ____ their design" so the choice supplies the word and its punctuation.

Return only the rewritten questions.`
      try {
        const repaired = await runStructured({ prompt: repairPrompt, schema: 'generated-reading-set.json', model: generationModel, effort: 'high', timeout: '3m' })
        broken.forEach((slot, index) => {
          const fixed = validateGeneratedReadingQuestion(repaired.questions?.[index], slot.entry)
          if (fixed) slot.question = fixed
        })
      } catch (error) {
        console.warn('Antigravity generation: repair pass failed, continuing with the items that passed.', error)
      }
    }

    const priorQuestions = [
      ...evidence.generatedQuestions,
      ...evidence.attempts.map((attempt) => attempt.questionSnapshot).filter(Boolean),
    ]
    const accepted = []
    const acceptedEntries = []
    for (const slot of slots) {
      if (!slot.question) continue
      if (hasSuspiciousReadingOverlap(slot.question, [...priorQuestions, ...accepted])) continue
      accepted.push(slot.question)
      acceptedEntries.push(slot.entry)
    }
    if (!accepted.length) throw new Error('No question in this batch passed the fidelity checks. The authored bank is being used for this set.')
    const reviewPrompt = `Act as an adversarial digital SAT item reviewer. Independently solve every candidate below without trusting any hidden answer key. Reject an item if more than one choice is defensible, no choice is fully defensible, the requested skill is not actually tested, a table is decorative, the difficulty is mislabeled, or the wording is unlike a concise official digital SAT item. Accept only items you would be comfortable putting into scored practice.

BLUEPRINT
${JSON.stringify(cleanBlueprint, null, 2)}

CANDIDATES WITHOUT ANSWER KEYS
${JSON.stringify(accepted.map((question, index) => ({ index, section: question.section, domain: question.domain, skillId: question.skillId, difficulty: question.difficulty, stimulus: question.stimulus, secondaryStimulus: question.secondaryStimulus, table: question.table, prompt: question.prompt, choices: question.choices })), null, 2)}

Return one review for every candidate index in order. solvedAnswer is your independently derived A-D answer. uniqueAnswer must be false whenever another choice could reasonably be defended.`
    const reviewed = await runStructured({ prompt: reviewPrompt, schema: 'generated-reading-review.json', model: observerModel, effort: 'high', timeout: '3m' })
    // Reviews are indexed against `accepted`, so items are matched by that
    // index rather than by position in a filtered array; otherwise partial
    // acceptance would attach the wrong blueprint to a record.
    const reviews = reviewed.reviews || []
    const reviewResults = accepted.map((question, index) => ({ question, entry: acceptedEntries[index], review: reviews.find((item) => item.index === index) }))
    const passesReview = (item) => item.review?.verdict === 'accept' && item.review.uniqueAnswer === true && item.review.solvedAnswer === item.question.answer
    let survivors = reviewResults.filter(passesReview)
    const flagged = reviewResults.filter((item) => !passesReview(item))

    // A reviewer rejection usually means one distractor is still defensible,
    // not that the whole item is unsalvageable. Giving the generator the
    // specific disagreement and a second try recovers real items instead of
    // dropping them, the same way the length-repair pass already does above.
    if (flagged.length) {
      const repairPrompt = `An independent reviewer solved ${flagged.length} of your questions and disagreed with your answer key or found more than one defensible choice. Rewrite only these items so exactly one choice survives an independent solve. You may rewrite the passage, the choices, or both; keep the same skill, domain, and difficulty. Return them in the order listed, one per entry.

ITEMS AND THE REVIEWER'S DISAGREEMENT
${JSON.stringify(flagged.map((item, index) => ({
  index,
  blueprint: item.entry,
  yourStimulus: item.question.stimulus,
  yourSecondaryStimulus: item.question.secondaryStimulus,
  yourChoices: item.question.choices,
  yourAnswer: item.question.answer,
  reviewerSolvedAnswer: item.review?.solvedAnswer ?? 'no verdict returned',
  reviewerSaysUnique: item.review?.uniqueAnswer ?? false,
  reviewerReason: item.review?.reason ?? 'The reviewer could not confirm a unique defensible answer.',
})), null, 2)}

If the reviewer's solved answer differs from yours, decide which one the text actually supports and rewrite the item so that choice is unambiguously correct and the other three are each rejected by a specific, stated flaw. If the reviewer says no choice is unique, strengthen whichever distractor is currently also defensible until it is clearly wrong, or sharpen the passage's evidence for the intended answer. The same distractor taxonomy, passage-length targets, and blank-format rules from the original instructions still apply.

Return only the rewritten questions.`
      try {
        const repaired = await runStructured({ prompt: repairPrompt, schema: 'generated-reading-set.json', model: generationModel, effort: 'high', timeout: '3m' })
        const rewritten = flagged
          .map((item, index) => ({ entry: item.entry, question: validateGeneratedReadingQuestion(repaired.questions?.[index], item.entry) }))
          .filter((item) => item.question)
        if (rewritten.length) {
          const recheckPrompt = `Independently solve each candidate below without trusting any hidden answer key, the same standard as before. Return one review per index in order.

CANDIDATES WITHOUT ANSWER KEYS
${JSON.stringify(rewritten.map((item, index) => ({ index, section: item.question.section, domain: item.question.domain, skillId: item.question.skillId, difficulty: item.question.difficulty, stimulus: item.question.stimulus, secondaryStimulus: item.question.secondaryStimulus, table: item.question.table, prompt: item.question.prompt, choices: item.question.choices })), null, 2)}`
          const rechecked = await runStructured({ prompt: recheckPrompt, schema: 'generated-reading-review.json', model: observerModel, effort: 'high', timeout: '3m' })
          const recheckReviews = rechecked.reviews || []
          const rewrittenSurvivors = rewritten
            .map((item, index) => ({ question: item.question, entry: item.entry, review: recheckReviews.find((review) => review.index === index) }))
            .filter(passesReview)
          survivors = [...survivors, ...rewrittenSurvivors]
        }
      } catch (error) {
        console.warn('Antigravity generation: reviewer-rejection repair pass failed, continuing with the items that passed the first review.', error)
      }
    }

    if (!survivors.length) throw new Error('The independent answer-key review rejected every question in this batch. The authored bank is being used for this set.')
    if (survivors.length < accepted.length) {
      console.warn(`Antigravity generation: the reviewer flagged ${flagged.length} of ${accepted.length} items; recovered ${survivors.length - reviewResults.filter(passesReview).length} after a targeted rewrite, kept ${survivors.length} total.`)
    }
    // Only after both models have agreed on the answer is it safe to move the
    // key off whichever letter the generator favoured.
    const balanced = rebalanceAnswerPositions(survivors.map((item) => item.question))
    const reviewedAt = new Date().toISOString()
    const records = balanced.map((question, index) => ({
      ...question,
      generation: {
        model: generationModel,
        promptVersion,
        blueprint: survivors[index].entry,
        reviewerModel: observerModel,
        reviewerVerdict: survivors[index].review?.reason || 'Accepted after independent solve.',
        reviewedAt,
      },
    }))
    await saveGeneratedQuestions(records)
    return records
  })
}

export function queueAttemptAnalysis(attempt, question, learnerJustification) {
  if (queuedAttemptIds.has(attempt.id)) return Promise.resolve(null)
  queuedAttemptIds.add(attempt.id)
  const revision = resetRevision
  return enqueue(`answer ${attempt.id}`, async () => {
    const evidence = await getEvidence()
    const current = { ...attempt, reasoningNote: learnerJustification, questionSnapshot: question }
    const recentSameSkill = evidence.attempts.filter((item) => item.skillId === attempt.skillId && item.id !== attempt.id).slice(-8).map(compactAttempt)
    const prompt = `Analyze one SAT answer as a rigorous SAT tutor. The learner explicitly requested this review after answering.

CURRENT ANSWER EVENT
${JSON.stringify(compactAttempt(current), null, 2)}

RECENT SAME-SKILL EVIDENCE
${JSON.stringify(recentSameSkill, null, 2)}

CURRENT LEARNER MODEL
${JSON.stringify(evidence.learnerModel, null, 2)}

Requirements:
- Evaluate the learner's written justification directly: identify valid moves, missing warrants, unsupported leaps, misread wording, and any mismatch between the justification and selected answer.
- Separate answer correctness from reasoning quality. A correct answer can have weak reasoning; an incorrect answer can contain useful partial reasoning.
- Reconstruct the shortest reliable SAT method step by step, using the exact text, quantities, or grammar rule in the item.
- Teach the underlying concept, explain why the chosen option works or fails, and include one concise transfer question the learner can answer mentally.
- Compare elapsed time with the supplied estimated time, but never equate speed with mastery.
- Confidence is voluntary. If CURRENT ANSWER EVENT omits confidence, do not invent or infer a rating and do not discuss calibration. If it includes confidence, treat that explicit selection as one signal and compare it with the reasoning and outcome.
- The next move must name a concrete skill, difficulty, or review action.
- Be specific and comprehensive without padding. Do not use generic encouragement.
- Never call a skill mastered from one answer. A single item can demonstrate a method on that item, but learner-model claims based on it must remain tentative until repeated or transferred.
- Every analytical claim must cite real IDs from the evidence above.
- Write for the learner, not for a research log. Use plain language, short paragraphs, and familiar skill names. Never place raw UUIDs, ISO timestamps, or phrases such as "during the period" in reader-facing prose; IDs belong only in evidenceIds.
- Lead with what happened, why it matters, and one useful next step. Avoid clinical labels, inflated certainty, and repetitive restatement of the supplied data.
- Return the full updated learner model, retaining earlier claims that remain supported.`
    const result = await runStructured({ prompt, schema: 'attempt-analysis.json', model: observerModel, effort: 'high', timeout: '3m' })
    if (revision !== resetRevision) return null
    const createdAt = new Date().toISOString()
    const analysis = {
      id: `analysis-${attempt.id}`,
      attemptId: attempt.id,
      createdAt,
      model: observerModel,
      promptVersion,
      learnerJustification,
      ...result.analysis,
    }
    await Promise.all([
      saveAnalysis(analysis),
      saveLearnerModel(withTimestamp(result.learnerModel)),
    ])
    return analysis
  }).finally(() => queuedAttemptIds.delete(attempt.id))
}

function reportMarkdown(report, meta) {
  const skillName = (skillId) => skillId.split('-').map((word) => word === 'rw' ? 'R&W' : `${word[0]?.toUpperCase() || ''}${word.slice(1)}`).join(' ')
  const claims = (items) => items.length ? items.map((item) => `- ${item.claim}  \n  Evidence: ${item.evidenceIds.length || 'No'} recorded answer${item.evidenceIds.length === 1 ? '' : 's'} (${item.confidence})`).join('\n') : '- No defensible claim yet.'
  const priorities = report.studyPriorities.length ? report.studyPriorities.map((item) => `- **${skillName(item.skillId)}:** ${item.action} - ${item.reason}  \n  Evidence: ${item.evidenceIds.length} recorded answer${item.evidenceIds.length === 1 ? '' : 's'}`).join('\n') : '- Continue mixed calibration.'
  const days = report.sevenDayPlan.map((item) => `- **${item.day}, ${item.minutes} min:** ${item.work}  \n  Success check: ${item.successCheck}`).join('\n')
  const sections = report.sectionBreakdown.map((item) => `### ${item.section}\n\n**Accuracy:** ${item.accuracySummary}\n\n**Pacing:** ${item.pacingSummary}\n\n${claims(item.findings)}\n\n**Recommended focus:** ${item.recommendedFocus}`).join('\n\n')
  const skills = report.skillBreakdown.length ? report.skillBreakdown.map((item) => `- **${skillName(item.skillId)}: ${item.correct}/${item.total}, ${item.averageSeconds}s average.** ${item.diagnosis}  \n  Next: difficulty ${item.nextDifficulty}; ${item.action}`).join('\n') : '- No skill has enough evidence for a defensible breakdown.'
  const errors = report.errorTaxonomy.length ? report.errorTaxonomy.map((item) => `- **${item.label} (${item.count}):** ${item.mechanism}`).join('\n') : '- No error class is defensible yet.'
  return `# ${report.title}

_Generated ${new Date(meta.createdAt).toLocaleString()} from ${meta.answerCount} recorded answers._

## Executive summary

${report.executiveSummary}

## What changed

${claims(report.whatChanged)}

## Strengths

${claims(report.strengths)}

## Weaknesses and misconception patterns

${claims([...report.weaknesses, ...report.misconceptionPatterns])}

## Section breakdown

${sections}

## Skill-by-skill breakdown

${skills}

## Error taxonomy

${errors}

## Pacing and decisions

${claims(report.pacingAndDecisions)}

## Confidence calibration

${claims(report.confidenceCalibration)}

## Transfer and retention

${claims(report.transferAndRetention)}

## Study priorities

${priorities}

## Seven-day plan

${days}

## Recommended question mix

${report.recommendedMix}

## Limits of this analysis

${report.limitations.map((item) => `- ${item}`).join('\n') || '- None stated.'}
`
}

export function intervalFacts(attempts) {
  const summarize = (items) => ({
    total: items.length,
    correct: items.filter((item) => item.correct).length,
    averageSeconds: Math.round(items.reduce((sum, item) => sum + item.elapsedMs / 1000, 0) / Math.max(1, items.length)),
    averageTargetSeconds: Math.round(items.reduce((sum, item) => sum + (item.questionSnapshot?.estimatedSeconds ?? 0), 0) / Math.max(1, items.length)),
    evidenceIds: items.map((item) => item.id),
  })
  return {
    overall: summarize(attempts),
    sections: Object.fromEntries(['rw', 'math'].map((section) => [section, summarize(attempts.filter((item) => item.section === section))]).filter(([, facts]) => facts.total > 0)),
    skills: Object.fromEntries([...new Set(attempts.map((item) => item.skillId))].map((skillId) => [skillId, summarize(attempts.filter((item) => item.skillId === skillId))])),
    confidence: Object.fromEntries([...new Set(attempts.map((item) => item.confidence).filter(Boolean))].map((level) => [level, summarize(attempts.filter((item) => item.confidence === level))])),
  }
}

export function normalizeReport(report, attempts, facts, allowedEvidenceIds) {
  const sectionNames = { rw: 'Reading and Writing', math: 'Math' }
  const currentAttemptIds = new Set(attempts.map((item) => item.id))
  const allowedAttemptIds = allowedEvidenceIds ?? currentAttemptIds
  const cleanText = (value) => String(value || '')
    .replace(/\(\s*session\s+[0-9a-f-]{20,}\s*\)/gi, '')
    .replace(/\bsession\s+[0-9a-f-]{20,}\b/gi, 'this set')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, 'the recorded answer')
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g, 'the recorded date')
    .replace(/during the period/gi, 'Across this work')
    .replace(/\s{2,}/g, ' ')
    .trim()
  const claims = (items = []) => items.map((item) => ({ ...item, claim: cleanText(item.claim), evidenceIds: [...new Set(item.evidenceIds || [])].filter((id) => allowedAttemptIds.has(id)) }))
  const sectionBreakdown = Object.entries(facts.sections).map(([section, computed]) => {
    const generated = report.sectionBreakdown.find((item) => item.section === sectionNames[section])
    return {
      section: sectionNames[section],
      accuracySummary: `${computed.correct}/${computed.total} correct (${Math.round(computed.correct / computed.total * 100)}%)`,
      pacingSummary: `${computed.averageSeconds}s average against a ${computed.averageTargetSeconds}s authored target`,
      findings: claims(generated?.findings),
      recommendedFocus: cleanText(generated?.recommendedFocus ?? 'Collect more evidence in this section before changing the plan.'),
    }
  })
  const skillBreakdown = Object.entries(facts.skills).map(([skillId, computed]) => {
    const generated = report.skillBreakdown.find((item) => item.skillId === skillId)
    return {
      skillId,
      correct: computed.correct,
      total: computed.total,
      averageSeconds: computed.averageSeconds,
      diagnosis: cleanText(generated?.diagnosis ?? 'Insufficient evidence for a mechanism-level diagnosis.'),
      nextDifficulty: generated?.nextDifficulty ?? Math.max(1, Math.min(5, Math.round(attempts.find((item) => item.skillId === skillId)?.difficulty ?? 3))),
      action: cleanText(generated?.action ?? 'Collect another varied item before changing difficulty.'),
      evidenceIds: computed.evidenceIds,
      confidence: generated?.confidence ?? 'tentative',
    }
  })
  const errorTaxonomy = report.errorTaxonomy.map((item) => {
    const evidenceIds = [...new Set(item.evidenceIds)].filter((id) => currentAttemptIds.has(id) && !attempts.find((attempt) => attempt.id === id)?.correct)
    return { ...item, label: cleanText(item.label), mechanism: cleanText(item.mechanism), evidenceIds, count: evidenceIds.length }
  }).filter((item) => item.count > 0)
  const studyPriorities = (report.studyPriorities || []).map((item) => ({ ...item, action: cleanText(item.action), reason: cleanText(item.reason), evidenceIds: [...new Set(item.evidenceIds || [])].filter((id) => allowedAttemptIds.has(id)) }))
  const learnerModel = {
    ...report.learnerModel,
    summary: cleanText(report.learnerModel?.summary),
    strengths: claims(report.learnerModel?.strengths),
    hypotheses: claims(report.learnerModel?.hypotheses),
    priorities: claims(report.learnerModel?.priorities),
    skillDirectives: (report.learnerModel?.skillDirectives || []).map((item) => ({ ...item, reason: cleanText(item.reason), evidenceIds: [...new Set(item.evidenceIds || [])].filter((id) => allowedAttemptIds.has(id)) })),
    coachingStyle: cleanText(report.learnerModel?.coachingStyle),
    nextSession: cleanText(report.learnerModel?.nextSession),
  }
  return {
    ...report,
    title: cleanText(report.title),
    executiveSummary: cleanText(report.executiveSummary),
    whatChanged: claims(report.whatChanged),
    strengths: claims(report.strengths),
    weaknesses: claims(report.weaknesses),
    misconceptionPatterns: claims(report.misconceptionPatterns),
    pacingAndDecisions: claims(report.pacingAndDecisions),
    confidenceCalibration: claims(report.confidenceCalibration),
    transferAndRetention: claims(report.transferAndRetention),
    sectionBreakdown,
    skillBreakdown,
    errorTaxonomy,
    studyPriorities,
    sevenDayPlan: (report.sevenDayPlan || []).map((item) => ({ ...item, day: cleanText(item.day), work: cleanText(item.work), successCheck: cleanText(item.successCheck) })),
    recommendedMix: cleanText(report.recommendedMix),
    limitations: (report.limitations || []).map(cleanText),
    learnerModel,
  }
}

async function createReport({ id, type, period, attempts, sessions, model, effort }) {
  const revision = resetRevision
  const evidence = await getEvidence()
  const facts = intervalFacts(attempts)
  const prompt = `Write an evidence-bound ${type === 'comprehensive' ? 'complete learning-history' : 'completed-set'} SAT learning report and update the learner model.

PERIOD: ${period}
RAW ANSWER EVENTS
${JSON.stringify(attempts.map(compactAttempt), null, 2)}

SESSION RECORDS
${JSON.stringify(sessions, null, 2)}

COMPUTED INTERVAL FACTS (authoritative; do not recalculate or contradict)
${JSON.stringify(facts, null, 2)}

PRIOR AI OBSERVATIONS
${JSON.stringify(evidence.analyses.slice(-30), null, 2)}

CURRENT LEARNER MODEL
${JSON.stringify(evidence.learnerModel, null, 2)}

Requirements:
- Start with exact computed counts from the raw evidence. Give separate Reading and Writing and Math breakdowns whenever both appear.
- sectionBreakdown must include only sections with at least one answer in COMPUTED INTERVAL FACTS. Never add a 0/0 section.
- For every represented skill, report correct/total, average elapsed seconds, the most defensible mechanism, target difficulty, and a concrete action.
- Classify errors into evidence-supported mechanisms such as concept gap, text/condition misread, setup/model selection, execution, pacing, or confidence miscalibration. Do not force an error into a category without evidence.
- Go beyond accuracy summaries: infer decision habits, confidence calibration, transfer, retention, pacing, and the likely highest-leverage work.
- Confidence is voluntary. An omitted confidence field means no rating was supplied: do not infer a default, include it in calibration, or treat it as evidence. Analyze confidence only for attempts that contain an explicit rating.
- Separate evidence from hypothesis. Every claim cites exact attempt or session IDs.
- Do not call a one-off error a pattern. State limitations and missing evidence explicitly.
- Never call a skill mastered, firm, fluent, or retained unless at least three successful attempts span at least two materially different forms and there is retention or transfer evidence. With less evidence, say exactly what was demonstrated and keep the inference tentative.
- Transfer requires success on a materially different form; retention requires evidence from a later session. Do not infer either from one item or from a written intention to check work.
- Distinguish a calibration, practice-set, review-set, section, or full-mock report and calibrate the depth to the evidence volume.
- Create a realistic seven-day plan using targeted lessons, mixed practice, spaced recall, and timed work only when justified.
- Recommendations must include skill IDs and target difficulty in the learner model.
- Write directly to the learner in natural, compact language. The report should feel like a thoughtful tutor who knows their history, not a database export.
- Do not include session IDs, attempt IDs, raw ISO dates, or the phrase "during the period" in any title, summary, diagnosis, finding, action, reason, or limitation. Put exact identifiers only in evidenceIds.
- Titles must be short and human. For a completed set, describe the result or main lesson. For the complete history, use a timeless title rather than a weekly or period-ending title.
- Avoid repeating the same counts in several sentences. Explain what the numbers mean and what to do next.
- Return a complete updated learner model.`
  const generatedReport = await runStructured({ prompt, schema: 'report.json', model, effort, timeout: '3m' })
  const allowedEvidenceIds = new Set([...evidence.attempts.map((item) => item.id), ...evidence.sessions.map((item) => item.id)])
  const report = normalizeReport(generatedReport, attempts, facts, allowedEvidenceIds)
  if (revision !== resetRevision) return null
  const createdAt = new Date().toISOString()
  const title = type === 'comprehensive'
    ? 'Your complete SAT learning report'
    : `Set review: ${facts.overall.correct} of ${facts.overall.total} correct`
  const summary = {
    id, type, title, period, createdAt, executiveSummary: report.executiveSummary, model, answerCount: attempts.length,
    sectionBreakdown: report.sectionBreakdown,
    skillBreakdown: report.skillBreakdown,
    errorTaxonomy: report.errorTaxonomy,
    studyPriorities: report.studyPriorities,
    sevenDayPlan: report.sevenDayPlan,
    recommendedMix: report.recommendedMix,
    limitations: report.limitations,
  }
  await Promise.all([
    saveLearnerModel(withTimestamp(report.learnerModel)),
    saveReport(summary, reportMarkdown({ ...report, title }, summary), { ...report, ...summary }),
  ])
  return summary
}

export function queueSessionReport(session) {
  if (queuedReportIds.has(session.id)) return Promise.resolve(null)
  queuedReportIds.add(session.id)
  return enqueue(`session report ${session.id}`, async () => {
    if (await hasReport(session.id)) return null
    const evidence = await getEvidence()
    const attempts = evidence.attempts.filter((item) => item.sessionId === session.id)
    if (!attempts.length) throw new Error('No answer evidence was recorded for this session.')
    const period = `${session.startedAt} to ${session.completedAt || session.startedAt}`
    return createReport({ id: session.id, type: 'session', period, attempts, sessions: [session], model: sessionModel, effort: 'high' })
  }).finally(() => queuedReportIds.delete(session.id))
}

export function queueComprehensiveReport() {
  const id = `comprehensive-${new Date().toISOString().replace(/[:.]/g, '-')}`
  return enqueue('complete learning report', async () => {
    const evidence = await getEvidence()
    if (evidence.attempts.length < 3) throw new Error('At least three answers are needed for a complete learning report.')
    const first = evidence.attempts[0]?.createdAt ?? new Date().toISOString()
    const last = evidence.attempts.at(-1)?.createdAt ?? first
    return createReport({ id, type: 'comprehensive', period: `${first} to ${last}`, attempts: evidence.attempts, sessions: evidence.sessions, model: reportModel, effort: 'high' })
  })
}

export async function recoverPendingReports(limit = Number.POSITIVE_INFINITY) {
  if (!existsSync(agyBinary)) return 0
  const evidence = await getEvidence()
  const pending = []
  for (const session of evidence.sessions.filter((item) => item.completedAt).slice(-limit)) {
    if (!await hasReport(session.id)) pending.push(session)
  }
  for (const session of pending) queueSessionReport(session).catch(() => undefined)
  return pending.length
}
