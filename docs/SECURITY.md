# Security

## Reporting a vulnerability

**Please do _not_ open a public GitHub issue for security vulnerabilities.**

Report them privately via GitHub's **[Report a vulnerability](https://github.com/u-ways/obsidian-path-picker/security/advisories/new)**
(repo → **Security** → **Advisories** → _Report a vulnerability_), which opens a private
advisory visible only to the maintainers. If that's unavailable, contact the maintainer
privately via their GitHub profile ([@u-ways](https://github.com/u-ways)).

This is a community project maintained on a best-effort basis — please allow reasonable
time for triage before any public disclosure.

## What the plugin can access

Knowing the plugin's blast radius helps assess risk:

- **Desktop only.** It uses Node's `fs`/`path`/`os` (declared `isDesktopOnly: true`), so it
  never runs on Obsidian mobile.
- **Reads the local filesystem — read-only.** It walks directories under the chosen root
  and reads the head of files to render previews. All disk access funnels through a single
  module ([`src/core/fs-read.ts`](../src/core/fs-read.ts)) that exposes **only** read
  operations (`realpath`, `stat`, `opendir`, `readdir`, and a bounded file-head read). No
  `node:fs` write, create, delete, or rename API is reachable from the plugin code, and the
  file reader never hands out a writable file handle — so the plugin **cannot** modify, move,
  or delete any file on your system.
- **The only thing it writes** is the path string you select, inserted at your cursor through
  Obsidian's editor API (`editor.replaceSelection`) — never through the filesystem.
- **No network, no code execution, no telemetry.** It makes no network requests, runs no
  shell commands or external binaries, and collects/transmits no data.
- **Syntax highlighting is content-safe.** The file-preview head is placed in the DOM only as
  literal text (`code.setText(...)`) and then highlighted with Obsidian's **own bundled Prism**
  via the official `loadPrism()` API. File content is never parsed as Markdown or HTML — there
  is no fenced-code "break-out", no remote-image/embed/`dataviewjs` execution, and no `<script>`
  instantiation. The language is derived solely from the filename (a fixed allow-map), never from
  content. Highlighting runs synchronously over the **bounded** preview head (≤ 64 KB / 200 lines,
  with configurable size/line caps that skip highlighting for large or minified files), so it adds
  no new ReDoS surface beyond opening the same file in Obsidian's reading view. The plugin only
  **reads** the shared Prism instance — it never registers grammars or hooks, so it cannot affect
  your normal code-block rendering.

## Security measures in CI

- **SBOM + vulnerability scan** ([`.github/workflows/security.yml`](../.github/workflows/security.yml)):
  every pull request generates a CycloneDX SBOM with **syft** ([`anchore/sbom-action`](https://github.com/anchore/sbom-action))
  covering the full dependency tree (runtime **and** dev/build toolchain) and scans it with
  **grype** ([`anchore/scan-action`](https://github.com/anchore/scan-action)). The job **fails
  on findings at or above `high`** (the threshold is the `SEVERITY_CUTOFF` env in the workflow);
  lower-severity findings are printed but don't block. Both actions are SHA-pinned.
- **SBOM published with releases.** When a release is drafted, the SBOM (`sbom.cdx.json`) is
  attached to the draft so each release ships a supply-chain manifest. See
  [RELEASING.md](RELEASING.md).
- **Enforced read-only filesystem access.** An ESLint `no-restricted-imports` rule forbids
  importing `node:fs` anywhere under `src/` except the audited read-only facade
  ([`core/fs-read.ts`](../src/core/fs-read.ts)). The build fails if any module bypasses the
  facade, so a filesystem **write** path cannot be introduced unnoticed.
- **Other gates** (see [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)): ESLint —
  including a rule banning raw HTML injection (`innerHTML`/`outerHTML`/`insertAdjacentHTML`) so
  the modal builds DOM only via `createEl`/`createDiv`/`createSpan` — plus type-check, tests,
  and a production build. All must pass before merge.

## Dependencies

- The shipped plugin bundles a **single runtime dependency** ([`fzf`](https://github.com/ajitid/fzf-for-js)).
  The rest of the tree is the dev/build toolchain (esbuild, vitest, TypeScript, ESLint,
  Prettier), which the security scan also covers.
- Keep dependencies current; address scan findings by **upgrading the affected package**. If a
  finding can't be fixed and is acceptable, document the rationale (e.g. a grype ignore rule)
  rather than silently lowering the threshold.

## Secrets

- The plugin requires **no secrets** to build or run.
- CI uses the built-in `GITHUB_TOKEN`. Repository secrets are **`CLAUDE_CODE_OAUTH_TOKEN`**
  (used only by the "Release Detailer" / "Release Versioner" workflows via
  `anthropics/claude-code-action`) and **`RELEASE_AUTOMATION_TOKEN`** (the publish push-back);
  see [RELEASING.md](RELEASING.md).
- Never commit secrets, tokens, or credentials. Configure them as GitHub Actions secrets.
