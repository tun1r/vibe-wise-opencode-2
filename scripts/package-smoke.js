import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { Host } from "@opencode/plugin/host"

const root = fileURLToPath(new URL("../", import.meta.url))
const parent = join(tmpdir(), "opencode")
await mkdir(parent, { recursive: true })
const temporary = await mkdtemp(join(parent, "vibe-wise-package-"))
try {
  const [packed] = JSON.parse(execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", temporary], { cwd: root, encoding: "utf8" }))
  for (const path of ["index.js", "src/index.js", "src/state.js", "src/mode.js", "guides/learn.md", "guides/behavior.md", "guides/onboarding.md", "guides/reset.md", "guides/state-templates.md", "LICENSE", "NOTICE.md"]) {
    assert.ok(packed.files.some((file) => file.path === path), `Missing package file: ${path}`)
  }
  execFileSync("tar", ["-xzf", join(temporary, packed.filename), "-C", temporary])
  const directory = join(temporary, "package")
  // Only dependency resolution is shared; plugin code/guides come from the tarball.
  await symlink(join(root, "node_modules"), join(directory, "node_modules"))
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"))
  const entrypoints = Host.resolve({ directory, name: manifest.name })
  assert.ok(entrypoints.server, "V2 host could not resolve the package export")
  const localEntrypoints = Host.resolve({ directory })
  assert.ok(localEntrypoints.server, "V2 host could not resolve a local plugin directory")
  const local = await Host.load(localEntrypoints.server)
  assert.equal(local.default.id, "vibe-wise-opencode-2")
  const loaded = await Host.load(entrypoints.server)
  const plugin = loaded.default
  assert.equal(plugin.id, "vibe-wise-opencode-2")
  const commands = []
  const hooks = []
  const tools = []
  await plugin.setup({
    command: { transform: async (callback) => callback({ add: (command) => commands.push(command) }) },
    tool: { transform: async (callback) => callback({ add: (tool) => tools.push(tool.name) }) },
    session: {
      hook: async (name) => hooks.push(name),
      get: async () => ({ location: { directory: temporary } }),
      prompt: async (input) => {
        assert.ok(input.text.includes(join(directory, "guides")))
        assert.ok(input.text.includes("learner owns the design"))
      },
    },
  })
  assert.deepEqual(commands.map((command) => command.name), ["vibe-wise:learn", "vibe-wise:pause", "vibe-wise:reset"])
  assert.deepEqual(hooks, ["context", "compaction"])
  assert.deepEqual(tools, ["vibe_wise_reset"])
  await commands[0].execute({ sessionID: "package-smoke", prompt: { text: "" }, delivery: "steer" })
  console.log(`Packed artifact loaded successfully with OpenCode V2 Host: ${packed.filename}`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
