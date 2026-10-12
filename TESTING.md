# Testing

Use Node.js 22+ and install dependencies with `npm ci --ignore-scripts`.

| Check | Command | What it verifies |
| --- | --- | --- |
| Unit/integration tests | `npm test` | Project boundaries, legacy notes, activation/pause, symlink refusal, read-only preview, confirmed backups, stale tokens, session moves, V2 command/hook behavior. |
| API contract | `npm run typecheck` | JavaScript type checking against the pinned real V2 plugin types. |
| Distribution smoke | `npm run test:package` | Packs/extracts the actual artifact, resolves and loads it with V2 Host, registers commands/tools/hooks, and executes the Learn command using bundled guides. |

Tests create isolated directories under the OS temporary directory's `opencode/`
folder and remove only their own fixtures. They never read real learner notes,
provider credentials, global OpenCode configuration, or conversation history.

Plugin integration tests use a mocked V2 context. They prove registration,
prompt delivery, and context assembly, not a model's adherence to the pedagogy.
The initial release also passed an isolated OpenCode V2 2.0.27 server check:
the local directory plugin became active and all three slash commands appeared
in the real server's command registry. The server used temporary configuration
and data directories, with no provider credentials or model requests.
Manual checks with a configured OpenCode V2 model are still needed for native
picker rendering, onboarding quality, checkpoint adherence, and user-visible
compaction behavior. Do not claim those checks passed from unit tests alone.

Name regression tests after user-visible behavior. When changing a branch in note
discovery or reset, cover both its positive and negative paths. Keep destructive
operations restricted to temporary fixtures. Never include actual learner data.
