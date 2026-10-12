# Contributing

This is a personal, independently maintained project targeting **OpenCode V2 only**.
Keep changes small, preserve compatibility with upstream learner notes, and retain
the upstream MIT notice. Do not copy behavior from a V1 port into the V2 API adapter.

1. Use Node.js 22+ and `npm ci --ignore-scripts`.
2. Make a focused change with regression tests.
3. Run `npm test`, `npm run typecheck`, and `npm run test:package`.
4. Update README/CHANGELOG when behavior or installation changes.

`src/index.js` owns V2 registrations and session-scoped context restoration.
`src/state.js` owns local note discovery, activation detection, and backed-up reset.
`src/mode.js` owns explicit on/off changes without discarding learner preferences.
`guides/` contains the adapted learning instructions. Preserve the distinction
between agreeing to a design and authorizing implementation.

For upstream guide updates, compare against the revision in NOTICE.md, port only
relevant changes, retain OpenCode tool references, and update that notice. For API
updates, read the current V2 plugin docs, update the pinned dependency, and rerun
all checks plus a real V2 smoke check. Never silently change global configuration.

For a release, update package.json and package-lock.json together, document the
version in CHANGELOG.md, and push a matching `v<version>` tag. The release workflow
verifies the tag/version match and uploads the npm-format tarball to GitHub.
Publishing to npm is a separate, explicit future decision.
