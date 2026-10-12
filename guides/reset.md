# Reset VibeWise learning

Run only on explicit user invocation, in the main conversation. Reset only the
profile, progress, pending checkpoints, and saved map. Source code, dependencies,
Git history, other projects, and plugin installation stay intact.

1. Call `vibe_wise_reset` with `{}` for a read-only preview of THIS session's
   project. If there are no notes, explain there's nothing to reset and suggest
   `/vibe-wise:learn`. On errors, stop and explain; never improvise deletions.
2. Show the returned absolute project/state paths, affected files, and backup
   parent. Use the native `question` picker with one question, `multiple: false`,
   header `Reset`, and options **Cancel** (keep notes) and **Reset learning**
   (back up notes and restart onboarding). Name the project in the question.
   If unavailable, ask in text. Wait for explicit confirmation. Invocation,
   silence, ambiguous replies, and tool permission do not confirm reset.
3. Only after **Reset learning**, call `vibe_wise_reset` with the preview's exact
   `confirmation` value. If notes or the session's project changed, preview again
   and obtain fresh confirmation. Never overwrite backups or fall back to another
   state directory. On failure, report the backup path if present, don't claim
   success, and don't start onboarding.
4. On success, show the backup path and invoke Learn again. Discard pre-reset
   preferences, mastery, pending decisions, and onboarding answers; don't restore
   them from conversation or backups. Inspect actual code to rebuild the map.
   Start fresh onboarding one question at a time.
