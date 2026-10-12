import { randomUUID } from "node:crypto"
import { constants } from "node:fs"
import { open, rename, unlink } from "node:fs/promises"
import { join } from "node:path"
import { locateState } from "./state.js"

/** Explicitly switch existing notes without onboarding or discarding preferences.
 * @param {string} cwd
 * @param {'active' | 'paused'} mode
 */
export async function setLearningMode(cwd, mode) {
  const target = await locateState(cwd)
  if (!target.exists) return { ...target, changed: false }
  const path = join(target.state, "profile.md")
  let profile
  try {
    profile = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return { ...target, changed: false }
    throw error
  }
  let stat
  let original
  try {
    stat = await profile.stat()
    original = await profile.readFile()
  } finally {
    await profile.close()
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(original)
  const marker = `Learning mode: ${mode}`
  const updated = /^Learning mode:[^\r\n]*$/im.test(text)
    ? text.replace(/^Learning mode:[^\r\n]*$/gim, marker)
    : `${marker}\n\n${text}`
  if (updated === text) return { ...target, changed: false }

  const temporary = join(target.state, `.profile-${randomUUID()}`)
  try {
    const file = await open(temporary, "wx", stat.mode & 0o777)
    try {
      await file.writeFile(updated, "utf8")
    } finally {
      await file.close()
    }
    await locateState(cwd)
    const current = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      if (!(await current.readFile()).equals(original)) throw new Error("Profile changed. Retry the learning-mode command.")
    } finally {
      await current.close()
    }
    await rename(temporary, path)
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error
    })
  }
  return { ...target, changed: true }
}
