import assert from "node:assert/strict"
import { readFile, readdir, rm, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { setLearningMode } from "../src/mode.js"
import { profileIsActive } from "../src/state.js"
import { fixture, notes } from "../test-support/fixtures.js"

test("explicit pause and resume preserve all preferences and pending decisions", async (t) => {
  const root = await fixture(t)
  const state = await notes(root, "# Profile\n\nLearning mode: active\n\nExperience: Advanced\n")
  await writeFile(join(state, "progress.md"), "## Pending decision\nAwaiting implementation approval")
  assert.equal((await setLearningMode(root, "paused")).changed, true)
  assert.equal(await profileIsActive(state), false)
  assert.equal(await readFile(join(state, "profile.md"), "utf8"), "# Profile\n\nLearning mode: paused\n\nExperience: Advanced\n")
  assert.equal((await setLearningMode(root, "paused")).changed, false)
  assert.equal((await setLearningMode(root, "active")).changed, true)
  assert.equal(await profileIsActive(state), true)
  assert.match(await readFile(join(state, "progress.md"), "utf8"), /Awaiting implementation approval/)
  assert.deepEqual(await readdir(state), ["profile.md", "progress.md"])
})

test("pause without existing profile never creates notes or activates a project", async (t) => {
  const root = await fixture(t)
  assert.equal((await setLearningMode(root, "paused")).changed, false)
  assert.deepEqual(await readdir(root), [])
  const state = await notes(root)
  await rm(join(state, "profile.md"))
  assert.equal((await setLearningMode(root, "paused")).changed, false)
  assert.deepEqual(await readdir(state), [])
})

test("legacy profiles without a mode marker can be switched off", async (t) => {
  const root = await fixture(t)
  const state = await notes(root, "# Profile\nExperience: Intermediate", ".sensible-vibes")
  await setLearningMode(root, "paused")
  assert.equal(await readFile(join(state, "profile.md"), "utf8"), "Learning mode: paused\n\n# Profile\nExperience: Intermediate")
  assert.equal(await profileIsActive(state), false)
})

test("mode switching refuses invalid UTF-8 and symlinked notes", async (t) => {
  const root = await fixture(t)
  const state = await notes(root)
  await writeFile(join(state, "profile.md"), Buffer.from([0xff]))
  await assert.rejects(setLearningMode(root, "paused"), /encoded data/i)
  await rm(join(state, "profile.md"))
  await symlink(join(root, "outside"), join(state, "profile.md"))
  await assert.rejects(setLearningMode(root, "paused"), /non-regular note/)
})
