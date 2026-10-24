

## Publishing default: verified local builds

User-requested workspace policy: when asked to publish, release, or prepare a
production release, build, test, and package on this computer. Use GitHub for
source history, version tags, release notes, and finished release downloads.

- Read the project's instructions and runbooks, then use or establish its own
  repeatable local release script. Do not assume Tool Atlas commands fit it.
- Run the project's required checks locally, including database lifecycle,
  migration, packaging, and deployment checks where applicable. Preserve all
  existing safety gates. If prerequisites are missing or checks fail, report
  the blocker; do not publish an unverified release or silently use cloud CI.
- Before pushing source or tags, inspect automatic workflows and disable or
  migrate hosted build/release triggers so the push cannot start cloud builds.
  Do not enable or run GitHub-hosted Actions without explicit user authorization.
  This local execution requirement supersedes older instructions to wait for
  hosted CI; the checks themselves remain required.
- Release only intended committed changes from a clean checkout/worktree.
  Keep private data, credentials, local configuration, and unrelated edits out.
- Keep version, release notes, and tag consistent. Generate SHA256 checksums,
  upload verified packages as a draft release, download them again, and compare
  hashes before publishing. Record the source commit and local validation.
  Never overwrite an existing published release; use a new version.
- Publishing alone does not mean installing on production. The user performs
  installation unless they explicitly request deployment as a separate action.
- Keep this policy in the project's instructions when updating its release
  process. This note does not itself disable existing workflows or configure
  a working local build script; those steps must be verified before publishing.
