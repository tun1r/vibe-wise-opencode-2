# VibeWise for OpenCode 2

**You design. AI writes. You understand what gets built.**

A personal, independently maintained OpenCode **V2** adapter for
[VibeWise](https://github.com/nykooi1/vibe-wise). The agent asks for your approach,
helps you examine tradeoffs, waits for implementation approval, then explains
what changed and how the code works.

This is not the upstream plugin or a V1 port. Other OpenCode implementations
exist; this project specifically targets the native V2 plugin API.

## Requirements

- OpenCode V2. This version is tested against the `@opencode/plugin` **2.0.27**
  contract and does **not** support OpenCode 1.x.
- Node.js 22+ and npm for local development/installation.
- Linux is the initial tested platform. Other platforms are not yet verified.

No Python, extra service, VibeWise account, API key, or telemetry.

## Install

### From GitHub

In **OpenCode V2**, run:

```sh
opencode plugin add github:tun1r/vibe-wise-opencode-2
```

Or add the Git package to your existing `opencode.jsonc`. Preserve unrelated
settings and existing plugin entries:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:tun1r/vibe-wise-opencode-2"],
}
```

The Git package tracks the repository's default branch. Pin a complete commit
hash for reproducible installations. No npm release is required for Git install.

### Local development

```sh
git clone https://github.com/tun1r/vibe-wise-opencode-2.git
cd vibe-wise-opencode-2
npm ci --ignore-scripts
```

Add the checkout's **absolute directory** to `plugins` in your OpenCode V2
configuration, for example:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/vibe-wise-opencode-2"],
}
```

Restart V2 if changes to this external checkout aren't picked up:

```sh
opencode service restart
```

Don't configure this package in a V1 installation. If both versions are installed,
use your V2 executable (`opencode2` where available) for the commands above.

## Use

Start OpenCode in the project you want to learn, then run:

```text
/vibe-wise:learn
```

Setup asks one question at a time. Choose defaults or customize experience,
checkpoint frequency, and question style. Ask for a feature in plain English.

| Checkpoint | What happens |
| --- | --- |
| Build | You reason through your approach with the agent. |
| Design | Confirm a design and continue planning. No code authorization yet. |
| Implementation | Approve the specific changes the agent may implement. |

After implementation, the agent reports what changed, how it works, and what
tests actually ran. You can say “explain this concept,” “fewer checkpoints,”
“just implement this one,” or “pause learning.” Run `/vibe-wise:learn` to resume.

### Switch learning on or off

| Command | Effect |
| --- | --- |
| `/vibe-wise:learn` | Turn learning **on** for this project; onboard once or resume existing notes. |
| `/vibe-wise:pause` | Turn learning **off** immediately; keep your preferences and progress. |
| `/vibe-wise:reset` | Back up and restart learning notes after separate confirmation, **not** an off switch. |

**Installing is not activation.** New projects stay off until you invoke Learn.
Once enabled, the choice persists in that project's profile across sessions and
compaction. Pause writes `Learning mode: paused` directly, without relying on the
model to remember to do it. The context and compaction hooks then stop adding
learning instructions until explicit Learn resumes it. The commands send a brief
model prompt after switching, but the saved switch itself is deterministic.

This is project-scoped, not a global or per-session switch: another project keeps
its own setting. Existing upstream nonempty profiles without a mode marker count
as active for compatibility; run Pause to turn those off. To remove the plugin
entirely, remove its package entry from your V2 configuration. Your saved notes
remain intact.

### Notes and privacy

Notes use the same format as upstream VibeWise:

```text
.vibe-wise/
├── profile.md
├── progress.md
└── project-map.md
```

Inside Git, lookup stops at the nearest repository or worktree boundary, preferring
the nearest notes directory. Without Git, only the session's current directory is
used. Legacy `.sensible-vibes/` notes stay in place. Symlinked note paths are refused.
Session moves use the new session location, not the plugin installation's location.

Add your notes directory to your project's `.gitignore` if you want private learning
notes. The plugin never silently edits it. Notes are read into your normal model
context by the agent, so your OpenCode/provider data policies still apply.

### Reset safely

```text
/vibe-wise:reset
```

The agent previews the exact project/files, asks **Cancel / Reset learning**, and
only after your confirmation invokes the reset helper. It backs up original notes
under `.vibe-wise/backups/reset-*/` before replacing the three learning files and
starting fresh onboarding. Source code is untouched. A stale confirmation token,
changed target, or symlink is rejected.

This is a learning workflow, **not a security sandbox**. Checkpoint approval and
the reset confirmation rely on the agent following instructions; OpenCode's tool
permissions still apply. Keep only one session editing/resetting a project's notes
at a time. Reset is not a multi-file filesystem transaction; if interrupted during
replacement, inspect the notes and reported backup before continuing.

## Development

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run test:package
```

See [TESTING.md](TESTING.md) for coverage and verification limits, and
[CONTRIBUTING.md](CONTRIBUTING.md) for maintenance. CI runs the same checks on
Node.js 22 and 24. Tagging `v<package version>` builds a GitHub release tarball;
the project does not automatically publish to npm.

## Automated maintenance

A GitHub Actions watcher runs daily at **03:17 UTC** (08:47 India time), even if
your laptop is off. It checks the original VibeWise main branch and stable OpenCode
V2 CLI releases, then opens or updates review issues assigned to `tun1r`.
Duplicate daily alerts are suppressed. Closing an issue acknowledges that exact
upstream tip; a newer revision reopens it.

Dependabot separately checks `@opencode/plugin` on its daily schedule (weekdays)
and opens dependency-update PRs. Each PR runs our existing CI tests, type checks,
and package smoke checks. Major-version upgrades are excluded. GitHub may delay
checks or apply a cooldown before creating a PR.

**No automatic merges or source porting.** Upstream teaching changes need a reviewed
OpenCode adaptation. Neither job upgrades your local OpenCode, changes learner
notes, enables learning mode, or uses an AI API key. Only GitHub's built-in scoped
workflow token is needed.

- Run the watcher manually: **Actions → Upstream watch → Run workflow**.
- Read-only local preview: `node scripts/upstream-watch.js --dry-run`.
- Pause alerts: **Actions → Upstream watch → … → Disable workflow**.
- Pause dependency PRs: set `open-pull-requests-limit: 0` in `.github/dependabot.yml`.
- After porting upstream changes, update the source revision in `NOTICE.md`.
- After reviewing a new CLI release, update `.github/maintenance.json`.

Schedules run from the default branch. GitHub can delay scheduled runs or disable
them after prolonged repository inactivity; check the Actions page if checks stop.

## Attribution and license

MIT. Adapted guides and note/reset semantics come from Noah Kim's VibeWise.
See [NOTICE.md](NOTICE.md) for the pinned upstream revision and [LICENSE](LICENSE)
for the full notice. Unofficial, not endorsed by VibeWise or OpenCode.
