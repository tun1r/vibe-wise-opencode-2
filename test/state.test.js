import assert from "node:assert/strict"
import { mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { freshNotes, locateState, profileIsActive, resetNotes } from "../src/state.js"
import { fixture, notes } from "../test-support/fixtures.js"

test("new state targets the nearest Git root, including nested source directories", async (t) => {
  const root = await fixture(t)
  await mkdir(join(root, ".git"))
  const cwd = join(root, "src", "nested")
  await mkdir(cwd, { recursive: true })
  assert.deepEqual(await locateState(cwd), { cwd, project: root, state: join(root, ".vibe-wise"), exists: false })
})

test("a worktree .git file stops lookup before the parent repository", async (t) => {
  const root = await fixture(t)
  await mkdir(join(root, ".git"))
  await notes(root)
  const worktree = join(root, "worktree")
  await mkdir(worktree)
  await writeFile(join(worktree, ".git"), "gitdir: /irrelevant")
  const target = await locateState(worktree)
  assert.equal(target.project, worktree)
  assert.equal(target.exists, false)
})

test("without Git, never adopt a parent folder's notes", async (t) => {
  const root = await fixture(t)
  await notes(root)
  const cwd = join(root, "unrelated")
  await mkdir(cwd)
  assert.equal((await locateState(cwd)).state, join(cwd, ".vibe-wise"))
  assert.equal((await locateState(cwd)).exists, false)
})

test("nearest notes win; the modern name wins at the same level", async (t) => {
  const root = await fixture(t)
  await mkdir(join(root, ".git"))
  await notes(root)
  const cwd = join(root, "src")
  await mkdir(cwd)
  const legacy = await notes(cwd, "legacy", ".sensible-vibes")
  assert.equal((await locateState(cwd)).state, legacy)
  const modern = await notes(cwd)
  assert.equal((await locateState(cwd)).state, modern)
})

test("legacy notes stay in place, including across reset", async (t) => {
  const root = await fixture(t)
  const state = await notes(root, "original", ".sensible-vibes")
  const preview = await resetNotes(root)
  assert.equal(preview.state, state)
  const result = await resetNotes(root, preview.confirmation)
  assert.equal(result.state, state)
  assert.equal((await readdir(root)).includes(".vibe-wise"), false)
})

for (const dangling of [false, true]) {
  test(`reject ${dangling ? "dangling" : "existing"} symlink state instead of falling back`, async (t) => {
    const root = await fixture(t)
    await mkdir(join(root, ".git"))
    await notes(root)
    const cwd = join(root, "src")
    await mkdir(cwd)
    await symlink(dangling ? join(root, "missing") : join(root, ".vibe-wise"), join(cwd, ".vibe-wise"))
    await assert.rejects(locateState(cwd), /symlinked state/)
  })
}

for (const name of Object.keys(freshNotes)) {
  test(`reject symlinked ${name} on discovery and reset`, async (t) => {
    const root = await fixture(t)
    const state = await notes(root)
    await rm(join(state, name), { force: true })
    await symlink(join(root, "missing"), join(state, name))
    await assert.rejects(locateState(root), /non-regular note/)
    await assert.rejects(resetNotes(root), /non-regular note/)
  })
}

test("reject non-directory state and invalid working directories", async (t) => {
  const root = await fixture(t)
  await writeFile(join(root, ".vibe-wise"), "not a directory")
  await assert.rejects(locateState(root), /non-directory/)
  await assert.rejects(locateState("relative/path"), /absolute/)
  await assert.rejects(locateState(join(root, ".vibe-wise")), /must be a directory/)
})

test("active, old, blank, paused, missing, and invalid UTF-8 profiles", async (t) => {
  const root = await fixture(t)
  const state = await notes(root)
  assert.equal(await profileIsActive(state), true)
  await writeFile(join(state, "profile.md"), "old profile without marker")
  assert.equal(await profileIsActive(state), true)
  await writeFile(join(state, "profile.md"), " \n\t")
  assert.equal(await profileIsActive(state), false)
  await writeFile(join(state, "profile.md"), "Learning mode: active\n" + "large profile\n".repeat(10000) + "Learning mode: PAUSED\n")
  assert.equal(await profileIsActive(state), false)
  await writeFile(join(state, "profile.md"), Buffer.from([0xff]))
  assert.equal(await profileIsActive(state), false)
  await rm(join(state, "profile.md"))
  assert.equal(await profileIsActive(state), false)
  assert.equal(await profileIsActive(join(root, "absent")), false)
})

test("preview is read-only and resetting preserves original notes and application code", async (t) => {
  const root = await fixture(t)
  const state = await notes(root, "my preferences")
  await writeFile(join(state, "progress.md"), "## Pending decision\nAwaiting implementation approval")
  await writeFile(join(state, "project-map.md"), "a verified map")
  await writeFile(join(state, "other.md"), "untouched")
  await writeFile(join(root, "app.js"), "application code")
  const before = await readdir(state)
  const preview = await resetNotes(root)
  assert.equal(preview.status, "preview")
  assert.deepEqual(await readdir(state), before)
  assert.equal(await readFile(join(state, "profile.md"), "utf8"), "my preferences")
  const result = await resetNotes(root, preview.confirmation)
  assert.equal(result.status, "reset")
  assert.equal(await readFile(join(result.backup, "profile.md"), "utf8"), "my preferences")
  assert.match(await readFile(join(result.backup, "progress.md"), "utf8"), /Awaiting implementation approval/)
  for (const [name, text] of Object.entries(freshNotes)) assert.equal(await readFile(join(state, name), "utf8"), text)
  assert.equal(await readFile(join(state, "other.md"), "utf8"), "untouched")
  assert.equal(await readFile(join(root, "app.js"), "utf8"), "application code")
})

for (const change of ["edit", "add", "delete", "replace-state"]) {
  test(`reject stale confirmation after ${change}`, async (t) => {
    const root = await fixture(t)
    const state = await notes(root, "original")
    const preview = await resetNotes(root)
    if (change === "edit") await writeFile(join(state, "profile.md"), "changed")
    if (change === "add") await writeFile(join(state, "progress.md"), "new progress")
    if (change === "delete") await rm(join(state, "profile.md"))
    if (change === "replace-state") {
      // Keep the old inode allocated so the new directory has a distinct identity.
      const { rename } = await import("node:fs/promises")
      await rename(state, join(root, "old-state"))
      await notes(root, "original")
    }
    await assert.rejects(resetNotes(root, preview.confirmation), /changed/)
    assert.equal((await readdir(state)).includes("backups"), false)
  })
}

test("confirmation cannot reset another project with identical notes", async (t) => {
  const first = await fixture(t)
  const second = await fixture(t)
  await notes(first)
  await notes(second)
  const preview = await resetNotes(first)
  await assert.rejects(resetNotes(second, preview.confirmation), /changed/)
})

test("reject symlink backup path without modifying notes or the outside folder", async (t) => {
  const root = await fixture(t)
  const outside = await fixture(t)
  const state = await notes(root, "original")
  await symlink(outside, join(state, "backups"))
  const preview = await resetNotes(root)
  await assert.rejects(resetNotes(root, preview.confirmation), /symlinked state/)
  assert.equal(await readFile(join(state, "profile.md"), "utf8"), "original")
  assert.deepEqual(await readdir(outside), [])
})

test("empty notes never create state; missing companion notes are created only by confirmed reset", async (t) => {
  const root = await fixture(t)
  assert.equal((await resetNotes(root)).status, "no_notes")
  assert.deepEqual(await readdir(root), [])
  const state = await notes(root)
  const preview = await resetNotes(root)
  assert.deepEqual(preview.files, ["profile.md"])
  const result = await resetNotes(root, preview.confirmation)
  assert.deepEqual(await readdir(result.backup), ["profile.md"])
  assert.equal(await readFile(join(state, "progress.md"), "utf8"), freshNotes["progress.md"])
})

test("repeated resets keep unique backups, and cancellation changes nothing", async (t) => {
  const root = await fixture(t)
  const state = await notes(root, "original")
  const preview = await resetNotes(root)
  await assert.rejects(resetNotes(root, preview.confirmation, AbortSignal.abort()), /abort/i)
  assert.equal(await readFile(join(state, "profile.md"), "utf8"), "original")
  const first = await resetNotes(root, preview.confirmation)
  const second = await resetNotes(root, (await resetNotes(root)).confirmation)
  assert.notEqual(first.backup, second.backup)
  assert.equal(await readFile(join(first.backup, "profile.md"), "utf8"), "original")
})
