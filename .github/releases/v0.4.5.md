# CAMPEROS-ACCOUNTING 0.4.5 — October 2026 Node security maintenance

Require patched Node.js 22.23.4, 24.22.1 or 26.12.1 (or newer patches on those supported lines), as applicable to this application's existing runtime support. Node 24 builds use 24.22.1. `npm run check:node-security` reports the current runtime without loading configuration. Source deployments must update their own Node installation; updating a host does not patch an embedded runtime.

Refresh compatible locked dependency security fixes and use pinned pkg 6.24.0 for existing Node 22 executable builds where applicable. Remove the obsolete development watcher in favor of Node's native watcher where present. No schema migration, reseeding, application data rewrite or production configuration replacement is part of this patch.

Build/test/package locally using this project's runbook. Preserve existing database, Windows lifecycle, browser and rollback gates. Publishing is separate from installation. Verify downloaded release SHA256 checksums before installation; preserve the paired application/data rollback set.

Upstream: https://nodejs.org/en/blog/vulnerability/october-2026-security-releases

Both executables can be inspected with `server.exe --runtime-info`. The local release harness uses an explicitly guarded disposable loopback database and checks source and compiled startup, synthetic authentication, malformed compressed input, ZIP safety and embedded executable parity. Production database connection defaults are preserved.
