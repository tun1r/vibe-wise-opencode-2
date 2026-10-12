import { createHash } from "node:crypto"
import { constants } from "node:fs"
import { lstat, mkdir, mkdtemp, open, realpath, rename, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join } from "node:path"

export const freshNotes = {
  "profile.md": "# Learner Profile\n\nLearning mode: active\nOnboarding: incomplete\nOnboarding reset: pending\n\nRemaining onboarding: Project situation, experience, stack familiarity, goals, and preferences.\n",
  "progress.md": "# Learning Progress\n\nNo learning events recorded yet.\n",
  "project-map.md": "# Project Map\n\nNot mapped yet. Inspect the current project.\n",
}

/** @param {string} path */
async function statIfPresent(path) {
  try {
    return await lstat(path)
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return undefined
    throw error
  }
}

/** @param {string} path */
async function assertDirectory(path) {
  const stat = await statIfPresent(path)
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Refusing non-directory or symlinked state path: ${path}`)
  }
  return stat
}

/** @param {string} path */
async function readNote(path) {
  const stat = await statIfPresent(path)
  if (!stat) return undefined
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Refusing non-regular or symlinked note: ${path}`)
  }
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    if (!(await file.stat()).isFile()) throw new Error(`Not a regular note: ${path}`)
    return await file.readFile()
  } finally {
    await file.close()
  }
}

/** Find notes without invoking Git or crossing repository/worktree boundaries.
 * @param {string} cwd
 */
export async function locateState(cwd) {
  if (!isAbsolute(cwd)) throw new Error("Use an existing absolute project directory.")
  cwd = await realpath(cwd)
  if (!(await lstat(cwd)).isDirectory()) throw new Error("Project path must be a directory.")

  const ancestors = []
  let root
  for (let directory = cwd; ; directory = dirname(directory)) {
    ancestors.push(directory)
    if (await statIfPresent(join(directory, ".git"))) {
      root = directory
      break
    }
    if (dirname(directory) === directory) break
  }
  for (const directory of root ? ancestors : [cwd]) {
    for (const name of [".vibe-wise", ".sensible-vibes"]) {
      const state = join(directory, name)
      if (!(await statIfPresent(state))) continue
      await assertDirectory(state)
      for (const note of Object.keys(freshNotes)) {
        const stat = await statIfPresent(join(state, note))
        if (stat && !stat.isFile()) throw new Error(`Refusing non-regular note: ${join(state, note)}`)
      }
      return { cwd, project: directory, state, exists: true }
    }
  }
  const project = root ?? cwd
  return { cwd, project, state: join(project, ".vibe-wise"), exists: false }
}

/** Older nonempty profiles without a status marker remain active.
 * @param {string} state
 */
export async function profileIsActive(state) {
  try {
    await assertDirectory(state)
    const data = await readNote(join(state, "profile.md"))
    if (!data) return false
    const profile = new TextDecoder("utf-8", { fatal: true }).decode(data)
    return Boolean(profile.trim()) && !/^Learning mode:\s*paused\s*$/im.test(profile)
  } catch {
    return false
  }
}

/** @param {string} cwd */
async function snapshot(cwd) {
  const target = await locateState(cwd)
  /** @type {Record<string, Buffer>} */
  const notes = {}
  const digest = createHash("sha256").update(target.state)
  if (target.exists) {
    const stat = await assertDirectory(target.state)
    digest.update(JSON.stringify([stat.dev, stat.ino]))
    for (const name of Object.keys(freshNotes)) {
      const data = await readNote(join(target.state, name))
      if (data !== undefined) notes[name] = data
      digest.update(JSON.stringify([name, data?.toString("hex") ?? null]))
    }
  }
  return { ...target, notes, confirmation: digest.digest("hex") }
}

/** Preview by default. Only replace a previously confirmed, unchanged snapshot.
 * @param {string} cwd
 * @param {string | undefined} [confirmation]
 * @param {AbortSignal | undefined} [signal]
 */
export async function resetNotes(cwd, confirmation, signal) {
  signal?.throwIfAborted()
  const target = await snapshot(cwd)
  const files = Object.keys(target.notes)
  if (confirmation !== undefined && (!files.length || confirmation !== target.confirmation)) {
    throw new Error("Target or notes changed. Preview and confirm again; nothing reset.")
  }
  if (!files.length) return { status: "no_notes", project: target.project, state: target.state }
  const backupParent = join(target.state, "backups")
  if (confirmation === undefined) {
    return { status: "preview", project: target.project, state: target.state, files,
      backup_parent: backupParent, confirmation: target.confirmation }
  }

  signal?.throwIfAborted()
  if (await statIfPresent(backupParent)) await assertDirectory(backupParent)
  else await mkdir(backupParent, { mode: 0o700 })
  await assertDirectory(backupParent)
  const backup = await mkdtemp(join(backupParent, "reset-"))
  try {
    for (const [name, data] of Object.entries(target.notes)) {
      await writeFile(join(backup, name), data, { flag: "wx", mode: 0o600 })
    }
    for (const [name, text] of Object.entries(freshNotes)) {
      await writeFile(join(backup, `.new-${name}`), text, { flag: "wx", mode: 0o600 })
    }
    if ((await snapshot(cwd)).confirmation !== target.confirmation) {
      throw new Error("Notes changed during backup; active notes were not reset.")
    }
    signal?.throwIfAborted()
    for (const name of Object.keys(freshNotes)) {
      await rename(join(backup, `.new-${name}`), join(target.state, name))
    }
  } catch (error) {
    throw new Error(`Reset did not complete. Backup location: ${backup}. Check active notes before continuing.`, { cause: error })
  }
  return { status: "reset", project: target.project, state: target.state, backup }
}
