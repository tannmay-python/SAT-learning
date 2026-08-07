import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const officialPath = resolve(projectRoot, 'data/questions/official.jsonl')

/**
 * Questions extracted from the learner's own copies of the released practice
 * forms by `scripts/import-official-questions.py`.
 *
 * The file is deliberately gitignored: these items are College Board's
 * copyright and this repository is public. A clone without it simply has no
 * official material, so every failure here is silent and returns an empty
 * bank rather than breaking practice.
 */
export async function readOfficialQuestions() {
  let raw
  try {
    raw = await readFile(officialPath, 'utf8')
  } catch {
    return []
  }
  const questions = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const question = JSON.parse(trimmed)
      // A partially written final line is normal if an import was interrupted.
      if (question?.id && question.section && question.skillId && question.prompt) questions.push(question)
    } catch {
      continue
    }
  }
  return questions
}
