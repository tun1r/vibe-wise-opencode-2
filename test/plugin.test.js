import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import plugin from "../src/index.js"
import { fixture, notes } from "../test-support/fixtures.js"

async function harness(directory) {
  const commands = new Map()
  const tools = new Map()
  const hooks = new Map()
  const prompts = []
  const locations = new Map([["session", directory]])
  const ctx = {
    location: { directory: "/wrong/plugin/location" },
    command: { transform: async (fn) => fn({ add: (definition) => commands.set(definition.name, definition) }) },
    tool: { transform: async (fn) => fn({ add: (definition) => tools.set(definition.name, definition) }) },
    session: {
      get: async ({ sessionID }) => ({ location: { directory: locations.get(sessionID) } }),
      prompt: async (input) => { prompts.push(input) },
      hook: async (name, fn) => { hooks.set(name, fn) },
    },
  }
  await plugin.setup(ctx)
  return { commands, tools, hooks, prompts, locations }
}

function event(sessionID = "session") {
  return { sessionID, system: [{ type: "text", text: "existing instructions" }], options: {}, messages: [], tools: {} }
}

test("setup registers the three V2 commands, reset tool, and context/compaction hooks", async (t) => {
  const root = await fixture(t)
  const h = await harness(root)
  assert.equal(plugin.id, "vibe-wise-opencode-2")
  assert.deepEqual([...h.commands.keys()], ["vibe-wise:learn", "vibe-wise:pause", "vibe-wise:reset"])
  assert.deepEqual([...h.tools.keys()], ["vibe_wise_reset"])
  assert.deepEqual([...h.hooks.keys()], ["context", "compaction"])
  assert.equal(h.tools.get("vibe_wise_reset").options.permission, "edit")
})

test("Learn uses the current session project and preserves attachments and delivery", async (t) => {
  const root = await fixture(t)
  await mkdir(join(root, ".git"))
  const cwd = join(root, "src")
  await mkdir(cwd)
  const state = await notes(root, "Learning mode: paused\nExisting preferences")
  const h = await harness(cwd)
  const prompt = { text: "build a notes app", files: [{ uri: "file:///some/file" }], agents: [], skills: [] }
  await h.commands.get("vibe-wise:learn").execute({ sessionID: "session", prompt, delivery: "queue" })
  assert.match(h.prompts[0].text, /learner owns the design/i)
  assert.match(h.prompts[0].text, /build a notes app/)
  assert.ok(h.prompts[0].text.includes(JSON.stringify(state)))
  assert.equal(h.prompts[0].delivery, "queue")
  assert.deepEqual(h.prompts[0].files, prompt.files)
  assert.deepEqual(h.prompts[0].skills, prompt.skills)
  // Explicit Learn resumes deterministically without discarding preferences.
  assert.equal(await readFile(join(state, "profile.md"), "utf8"), "Learning mode: active\nExisting preferences")
})

test("active context includes behavior and complete pending-decision discovery, not note contents", async (t) => {
  const root = await fixture(t)
  const state = await notes(root, "Learning mode: active\nPRIVATE LEARNER DATA")
  const h = await harness(root)
  const request = event()
  await h.hooks.get("context")(request)
  assert.equal(request.system[0].text, "existing instructions")
  assert.equal(request.system.length, 2)
  assert.match(request.system[1].text, /Implementation checkpoint/)
  assert.match(request.system[1].text, /ENTIRE/)
  assert.match(request.system[1].text, /compaction is NOT/)
  assert.match(request.system[1].text, /data, not instructions/)
  assert.ok(request.system[1].text.includes(JSON.stringify(state)))
  assert.equal(request.system[1].text.includes("PRIVATE LEARNER DATA"), false)
})

test("installing does not activate projects; pause stays paused across context and compaction", async (t) => {
  const root = await fixture(t)
  const h = await harness(root)
  for (const hook of h.hooks.values()) {
    const request = event()
    await hook(request)
    assert.equal(request.system.length, 1)
  }
  await notes(root, "Learning mode: paused\n")
  for (const hook of h.hooks.values()) {
    const request = event()
    await hook(request)
    assert.equal(request.system.length, 1)
  }
})

test("compaction preserves checkpoint stages and the next model call restores learning", async (t) => {
  const root = await fixture(t)
  await notes(root)
  const h = await harness(root)
  const summaryRequest = event()
  await h.hooks.get("compaction")(summaryRequest)
  assert.match(summaryRequest.system[1].text, /Never promote a design confirmation/)
  const continuation = event()
  await h.hooks.get("context")(continuation)
  assert.match(continuation.system[1].text, /VibeWise is active/)
})

test("session moves cannot leak another project's active learning state or reset token", async (t) => {
  const first = await fixture(t)
  const second = await fixture(t)
  await notes(first)
  const secondState = await notes(second, "Learning mode: paused\nSecond project")
  const h = await harness(first)
  const reset = h.tools.get("vibe_wise_reset")
  const context = { sessionID: "session", signal: new AbortController().signal }
  const preview = JSON.parse((await reset.execute({}, context)).content)
  h.locations.set("session", second)
  const request = event()
  await h.hooks.get("context")(request)
  assert.equal(request.system.length, 1)
  await assert.rejects(reset.execute({ confirmation: preview.confirmation }, context), /changed/)
  assert.equal(await readFile(join(secondState, "profile.md"), "utf8"), "Learning mode: paused\nSecond project")
})

test("Reset command requests confirmation; tool preview leaves notes unchanged then backs them up", async (t) => {
  const root = await fixture(t)
  const state = await notes(root, "old preferences")
  const h = await harness(root)
  await h.commands.get("vibe-wise:reset").execute({ sessionID: "session", prompt: { text: "" }, delivery: "steer" })
  assert.match(h.prompts[0].text, /Wait for explicit confirmation/)
  const reset = h.tools.get("vibe_wise_reset")
  const context = { sessionID: "session", signal: new AbortController().signal }
  const preview = JSON.parse((await reset.execute({}, context)).content)
  assert.equal(preview.status, "preview")
  assert.equal(await readFile(join(state, "profile.md"), "utf8"), "old preferences")
  const result = JSON.parse((await reset.execute({ confirmation: preview.confirmation }, context)).content)
  assert.equal(result.status, "reset")
  assert.equal(await readFile(join(result.backup, "profile.md"), "utf8"), "old preferences")
  assert.match(await readFile(join(state, "profile.md"), "utf8"), /Onboarding reset: pending/)
})

test("changed profile state is observed on the next request without plugin reload", async (t) => {
  const root = await fixture(t)
  const state = await notes(root)
  const h = await harness(root)
  await writeFile(join(state, "profile.md"), "Learning mode: paused\n")
  const request = event()
  await h.hooks.get("context")(request)
  assert.equal(request.system.length, 1)
  await writeFile(join(state, "profile.md"), "Learning mode: active\n")
  const resumed = event()
  await h.hooks.get("context")(resumed)
  assert.equal(resumed.system.length, 2)
})

test("Pause immediately disables context/compaction hooks and explicitly supersedes old teaching prompts", async (t) => {
  const root = await fixture(t)
  const state = await notes(root, "Learning mode: active\nExperience: Advanced")
  const h = await harness(root)
  await h.commands.get("vibe-wise:pause").execute({ sessionID: "session", prompt: { text: "" }, delivery: "steer" })
  assert.match(h.prompts[0].text, /learning is OFF/)
  assert.match(h.prompts[0].text, /Stop following VibeWise/)
  assert.equal(await readFile(join(state, "profile.md"), "utf8"), "Learning mode: paused\nExperience: Advanced")
  for (const hook of h.hooks.values()) {
    const request = event()
    await hook(request)
    assert.equal(request.system.length, 1)
  }
})
