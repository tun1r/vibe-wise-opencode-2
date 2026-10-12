import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export async function fixture(t) {
  const parent = join(tmpdir(), "opencode")
  await mkdir(parent, { recursive: true })
  const directory = await mkdtemp(join(parent, "vibe-wise-test-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}

export async function notes(project, profile = "Learning mode: active\n", name = ".vibe-wise") {
  const state = join(project, name)
  await mkdir(state, { recursive: true })
  await writeFile(join(state, "profile.md"), profile)
  return state
}
