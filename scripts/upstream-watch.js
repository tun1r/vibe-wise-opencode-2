import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

/** Only stable V2 releases, never prereleases or a future V3. */
export function latestV2(versions) {
  const stable = Object.keys(versions).filter((version) => /^2\.\d+\.\d+$/.test(version))
  stable.sort((a, b) => {
    const left = a.split(".").map(Number)
    const right = b.split(".").map(Number)
    return right[1] - left[1] || right[2] - left[2]
  })
  if (!stable.length) throw new Error("The registry returned no stable OpenCode V2 releases.")
  return stable[0]
}

export function buildAlerts({ notice, vibeRevision, cliVersion, reviewedVersion, sdkVersion }) {
  const adopted = notice.match(/upstream commit\s+`([a-f0-9]{40})`/i)?.[1]
  if (!adopted || !/^[a-f0-9]{40}$/.test(vibeRevision)) throw new Error("Missing or invalid VibeWise revision.")
  if (!/^2\.\d+\.\d+$/.test(cliVersion) || !/^2\.\d+\.\d+$/.test(reviewedVersion)) {
    throw new Error("OpenCode review versions must be stable V2 versions.")
  }
  return [
    {
      marker: "<!-- maintenance:vibe-wise -->",
      stamp: `<!-- latest:${vibeRevision} -->`,
      title: "Review upstream VibeWise changes",
      changed: adopted !== vibeRevision,
      details: `Adapted revision: \`${adopted}\`\nLatest main revision: \`${vibeRevision}\`\n\n[Compare upstream changes](https://github.com/nykooi1/vibe-wise/compare/${adopted}...${vibeRevision})\n\n- Review learning guides, note templates, and reset/hook behavior.\n- Port relevant changes to OpenCode V2; do not copy Claude Code/Codex hooks blindly.\n- Preserve Noah Kim's attribution, learner approvals, and note compatibility.\n- Run \`npm test\`, \`npm run typecheck\`, and \`npm run test:package\`.\n- Update NOTICE.md's source revision only after reviewing and incorporating the changes.`,
    },
    {
      marker: "<!-- maintenance:opencode-v2 -->",
      stamp: `<!-- latest:${cliVersion} -->`,
      title: "Review OpenCode V2 compatibility",
      changed: cliVersion !== reviewedVersion,
      details: `Reviewed CLI version: \`${reviewedVersion}\`\nLatest stable V2 CLI: \`${cliVersion}\`\nPinned plugin API: \`${sdkVersion}\`\n\n[OpenCode release](https://github.com/anomalyco/opencode/releases/tag/v${cliVersion}) · [V2 plugin API docs](https://opencode.ai/v2/docs/build/plugins)\n\n- Review plugin/API release changes and any Dependabot SDK update PR.\n- Run tests, type checks, and packed-artifact checks.\n- Verify loading and slash commands in an isolated server for the new CLI version.\n- Perform learning-flow checks when behavior changes.\n- Update \`.github/maintenance.json\` only after compatibility review.\n\nThis alert does not upgrade the maintainer's installed OpenCode.`,
    },
  ]
}

/** One issue per source. Closing an issue acknowledges that exact upstream tip. */
export async function syncAlerts(github, repository, alerts) {
  const issues = []
  for (let page = 1; ; page++) {
    const batch = await github(`/repos/${repository}/issues?state=all&per_page=100&page=${page}`)
    issues.push(...batch)
    if (batch.length < 100) break
  }
  const results = []
  for (const alert of alerts) {
    const issue = issues.find((entry) => !entry.pull_request && entry.user?.login === "github-actions[bot]" && entry.body?.includes(alert.marker))
    if (!alert.changed) {
      if (issue?.state === "open") {
        await github(`/repos/${repository}/issues/${issue.number}`, "PATCH", { state: "closed" })
        results.push({ source: alert.title, action: "resolved" })
      }
      continue
    }
    const body = `${alert.marker}\n${alert.stamp}\n\n${alert.details}\n\nAutomation only reports/proposes changes. Nothing is merged or overwritten automatically. Close this issue to acknowledge the current tip; a newer upstream tip will reopen it.`
    if (issue?.state === "closed" && issue.body.includes(alert.stamp)) continue
    if (issue?.state === "open" && issue.body === body) continue
    const path = `/repos/${repository}/issues${issue ? `/${issue.number}` : ""}`
    const result = await github(path, issue ? "PATCH" : "POST", {
      title: alert.title, body, ...(issue ? { state: "open" } : { assignees: ["tun1r"] }),
    })
    results.push({ source: alert.title, action: issue ? "updated" : "created", url: result.html_url })
  }
  return results
}

export async function requestJSON(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`Update check failed: HTTP ${response.status} from ${new URL(url).hostname}`)
  return response.json()
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const repository = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN
  if (!dryRun && (repository !== "tun1r/vibe-wise-opencode-2" || !token)) {
    throw new Error("Issue writes require GITHUB_TOKEN and GITHUB_REPOSITORY=tun1r/vibe-wise-opencode-2. Use --dry-run for a read-only check.")
  }
  const github = (path, method = "GET", body) => requestJSON(`https://api.github.com${path}`, {
    method,
    headers: {
      accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const [notice, config, manifest, vibe, cli] = await Promise.all([
    readFile(new URL("../NOTICE.md", import.meta.url), "utf8"),
    readFile(new URL("../.github/maintenance.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
    github("/repos/nykooi1/vibe-wise/commits/main"),
    requestJSON("https://registry.npmjs.org/@opencode%2fcli", { headers: { accept: "application/vnd.npm.install-v1+json" } }),
  ])
  const alerts = buildAlerts({ notice, vibeRevision: vibe.sha, cliVersion: latestV2(cli.versions),
    reviewedVersion: config.reviewedOpenCodeV2, sdkVersion: manifest.dependencies["@opencode/plugin"] })
  console.log(JSON.stringify(dryRun ? alerts : await syncAlerts(github, repository, alerts), null, 2))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1 })
}
