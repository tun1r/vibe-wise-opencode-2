import assert from "node:assert/strict"
import test from "node:test"
import { buildAlerts, latestV2, requestJSON, syncAlerts } from "../scripts/upstream-watch.js"

const adopted = "a".repeat(40)
const latest = "b".repeat(40)
const inputs = {
  notice: `Adapted from upstream commit\n\`${adopted}\`.`, vibeRevision: latest,
  cliVersion: "2.0.28", reviewedVersion: "2.0.27", sdkVersion: "2.0.27",
}

function api(issues = []) {
  const calls = []
  return {
    calls,
    github: async (path, method = "GET", body) => {
      calls.push({ path, method, body })
      return method === "GET" ? issues.map((issue) => ({ user: { login: "github-actions[bot]" }, ...issue })) : { html_url: "https://github.com/tun1r/vibe-wise-opencode-2/issues/1" }
    },
  }
}

test("latest V2 sorts numerically and excludes V1, V3, and prereleases", () => {
  assert.equal(latestV2({ "1.99.0": {}, "2.0.9": {}, "2.0.28": {}, "2.10.0": {}, "2.11.0-beta": {}, "3.0.0": {} }), "2.10.0")
  assert.throws(() => latestV2({ "3.0.0": {} }), /no stable/)
})

test("alerts are grounded in NOTICE and reviewed CLI version; invalid baselines fail", () => {
  const alerts = buildAlerts(inputs)
  assert.equal(alerts.length, 2)
  assert.ok(alerts.every((alert) => alert.changed))
  assert.ok(alerts[0].details.includes(`${adopted}...${latest}`))
  assert.match(alerts[1].details, /does not upgrade/)
  assert.equal(buildAlerts({ ...inputs, vibeRevision: adopted })[0].changed, false)
  assert.equal(buildAlerts({ ...inputs, cliVersion: "2.0.27" })[1].changed, false)
  assert.throws(() => buildAlerts({ ...inputs, notice: "no attribution revision" }), /invalid VibeWise/)
  assert.throws(() => buildAlerts({ ...inputs, vibeRevision: "not a SHA" }), /invalid VibeWise/)
  assert.throws(() => buildAlerts({ ...inputs, cliVersion: "3.0.0" }), /stable V2/)
})

test("new changes create review issues assigned to the maintainer, not commits or PR merges", async () => {
  const mock = api()
  const results = await syncAlerts(mock.github, "tun1r/vibe-wise-opencode-2", buildAlerts(inputs))
  assert.equal(results.length, 2)
  assert.ok(mock.calls.slice(1).every((call) => call.method === "POST" && call.path.endsWith("/issues")))
  assert.deepEqual(mock.calls[1].body.assignees, ["tun1r"])
  assert.match(mock.calls[1].body.body, /Nothing is merged or overwritten/)
})

test("unchanged open alerts are not rewritten or duplicated", async () => {
  const first = api()
  await syncAlerts(first.github, "owner/repo", buildAlerts(inputs))
  const existing = first.calls.slice(1).map((call, index) => ({ number: index + 1, state: "open", body: call.body.body }))
  const second = api(existing)
  assert.deepEqual(await syncAlerts(second.github, "owner/repo", buildAlerts(inputs)), [])
  assert.equal(second.calls.length, 1)
})

test("closing an issue acknowledges the same tip, but newer tips reopen it", async () => {
  const [alert] = buildAlerts(inputs)
  const issue = { number: 42, state: "closed", body: `${alert.marker}\n${alert.stamp}` }
  const same = api([issue])
  assert.deepEqual(await syncAlerts(same.github, "owner/repo", [alert]), [])
  const changed = api([issue])
  await syncAlerts(changed.github, "owner/repo", [{ ...alert, stamp: `<!-- latest:${"c".repeat(40)} -->` }])
  assert.equal(changed.calls[1].method, "PATCH")
  assert.equal(changed.calls[1].body.state, "open")
})

test("a reviewed baseline closes an open alert and leaves closed alerts alone", async () => {
  const [alert] = buildAlerts({ ...inputs, vibeRevision: adopted })
  const open = api([{ number: 8, state: "open", body: alert.marker }])
  assert.equal((await syncAlerts(open.github, "owner/repo", [alert]))[0].action, "resolved")
  assert.deepEqual(open.calls[1].body, { state: "closed" })
  const closed = api([{ number: 8, state: "closed", body: alert.marker }])
  assert.deepEqual(await syncAlerts(closed.github, "owner/repo", [alert]), [])
})

test("PRs with matching markers cannot be mistaken for maintenance issues", async () => {
  const [alert] = buildAlerts(inputs)
  const mock = api([{ number: 9, state: "open", pull_request: {}, body: alert.marker }])
  await syncAlerts(mock.github, "owner/repo", [alert])
  assert.equal(mock.calls[1].method, "POST")
})

test("issue listing paginates instead of creating duplicates beyond the first page", async () => {
  const [alert] = buildAlerts(inputs)
  const calls = []
  const github = async (path, method = "GET", body) => {
    calls.push({ path, method, body })
    if (method !== "GET") return { html_url: "updated" }
    if (path.endsWith("page=1")) return Array.from({ length: 100 }, (_, i) => ({ number: i, body: "other issue" }))
    return [{ number: 101, state: "open", body: alert.marker, user: { login: "github-actions[bot]" } }]
  }
  await syncAlerts(github, "owner/repo", [alert])
  assert.equal(calls.length, 3)
  assert.ok(calls[2].path.endsWith("/101"))
  assert.equal(calls[2].method, "PATCH")
})

test("HTTP failures fail the watcher without logging credentials", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("private error detail", { status: 403 }))
  await assert.rejects(requestJSON("https://api.github.com/repos/example/repo", { headers: { authorization: "Bearer secret" } }), {
    message: "Update check failed: HTTP 403 from api.github.com",
  })
})

test("user-submitted marker text cannot hijack the bot's tracking issue", async () => {
  const [alert] = buildAlerts(inputs)
  const mock = api([{ number: 666, state: "closed", body: `${alert.marker}\n${alert.stamp}`, user: { login: "someone-else" } }])
  await syncAlerts(mock.github, "owner/repo", [alert])
  assert.equal(mock.calls[1].method, "POST")
  assert.ok(mock.calls.every((call) => !call.path.endsWith("/666")))
})
