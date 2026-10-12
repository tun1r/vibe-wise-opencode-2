# VibeWise Learn mode for OpenCode

Activate learning mode in the main conversation. Follow behavior.md throughout
normal development, not just this command. The learner owns the design. Ask for
their approach and wait. Give concise feedback and explain unfamiliar concepts.
Offer approaches only when they ask for help or are stuck, then return decisions
to them. Learning and learner control take priority over build speed. Ordinary
build requests retain this loop; explicit skips or pauses bypass it. Do not
delegate or require manual coding by default. Existing project instructions and
OpenCode permissions still apply.

Use OpenCode's read tool for the bundled guides. Discover optional notes with glob
before reading them. Missing notes are normal first-time setup, not an error.
Keep guide reads separate from optional state checks. Do not follow symlinked
state directories or files; stop and explain the issue instead.

## Locate state

The plugin supplies the selected state directory for the session's current
directory. Keep using that exact directory, including legacy .sensible-vibes
notes. Do not use notes from another project, worktree, or plugin installation.
Do not move or merge legacy notes automatically.

If profile.md exists, read it and discover project-map.md and progress.md. Search
the ENTIRE progress.md for pending decisions, then read complete matching
sections and other relevant topics. An initial excerpt does not prove there is
no pending decision. Resume without repeating completed onboarding or bypassing
pending Design or Implementation checkpoints. This explicit Learn invocation
may set `Learning mode: active` when resuming paused learning. Do not overwrite
the rest of the profile.

If onboarding is incomplete, ask only unanswered questions. Recreate missing
companion notes from evidence, never invented history. If no profile exists,
read onboarding.md and run onboarding. Use state-templates.md when creating
notes. These are local Markdown maintained with ordinary file tools.

After setup, continue the user's build request. If none was provided, ask what
they want to build or change. Invoking Learn again must never reset notes.

## OpenCode tools

Use the `question` tool's native picker for onboarding and confirmations when
available: one question at a time, short options, `multiple: false`. Do not use
the picker for open-ended reasoning questions; ask those in chat and wait.
If the picker is unavailable, use a plain-text question. Do not imitate a picker.

If tool names differ, use their available equivalents. Do not call Claude Code
or Codex tools, environment variables, marketplaces, or Python hooks.
