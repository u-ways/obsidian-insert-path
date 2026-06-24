# Releasing

Releases are automated. You merge to `main`, review an auto-drafted release that AI
agents have enriched _and_ SemVer-stamped, and click **Publish** — everything else
(version selection, sync, build, asset upload, commit-back) happens for you.

## Lifecycle

```mermaid
sequenceDiagram
    actor Dev as Maintainer
    participant Repo as main
    participant Draft as Draft Release
    participant Agent as Release Detailer
    participant Ver as Release Versioner
    participant Rel as GitHub Release
    participant Pub as Publish Release

    Dev->>Repo: merge PR (push to main)
    Repo->>Draft: on push
    Draft->>Rel: recreate draft at next PATCH version + native notes
    Draft-->>Agent: workflow_run completed
    Agent->>Rel: add user-facing Details from PRs + diff
    Agent-->>Ver: workflow_run completed
    Ver->>Rel: classify PRs/diff (patch/minor/major); re-tag draft to correct SemVer
    Dev->>Rel: review draft (tag already corrected)
    Dev->>Rel: Publish
    Rel->>Pub: release published
    Pub->>Pub: sync version files + build
    Pub->>Rel: upload main.js, manifest.json, styles.css
    Pub->>Repo: commit version sync + move tag
```

1. **Draft Release** (`.github/workflows/draft-release.yml`, on every push to `main`)
   computes a **provisional** next version and recreates a single **draft** release
   tagged at that version, with GitHub's native auto-generated notes (grouped by PR
   label via `.github/release.yml`).
    - Provisional version = latest semver tag with its **patch** incremented; if there
      are no tags yet, the first release is whatever `package.json` declares. This is a
      baseline only — _Release Versioner_ (step 3) corrects it to the right SemVer bump.
    - Tags are **not** `v`-prefixed (e.g. `0.1.1`) so they equal `manifest.json` — the
      Obsidian community store and BRAT require the tag to match the plugin version.

2. **Release Detailer** (`.github/workflows/release-detailer.md` → `.lock.yml`, a
   [gh-aw](https://github.com/github/gh-aw) agentic workflow) runs when _Draft Release_
   completes. A Copilot/Claude agent reads the PRs and diff in the release range and
   inserts a user-facing `### :bulb: Details` section into the draft, leaving the
   native `## What's Changed` and `**Full Changelog**` lines untouched.

3. **Release Versioner** (`.github/workflows/release-versioner.md` → `.lock.yml`,
   another gh-aw workflow) runs when _Release Detailer_ completes. The agent reads the
   same PRs/diff and decides — per [SemVer](https://semver.org/spec/v0.1.0.html) —
   whether the release is a **patch**, **minor**, or **major (breaking)** change. A
   deterministic job then recomputes the target version from the latest **published**
   release and, if it differs, re-tags the draft (and fixes the `**Full Changelog**`
   compare link), so the draft already carries the right version before you see it.
    - **Bump → version:** `major` → `1.0.0`, `minor` → `0.2.0`, `patch` → `0.1.4`
      (computed from the latest published tag). The agent only ever classifies; the
      version maths and the `gh release edit` live in the workflow's safe-output job,
      which **only ever edits a draft** — never a published release.
    - **Pre-1.0 policy:** while the plugin is `0.y.z`, a `major` decision jumps to
      `1.0.0`. To keep breaking changes inside `0.x` until you deliberately cut a stable
      `1.0`, change the `major)` arm of the version maths in `release-versioner.md` to
      `target="${major}.$((minor + 1)).0"` and recompile.
    - Re-tagging uses `gh release edit --tag`, which keeps the same release object — so
      the enriched body and every attached asset (e.g. the SBOM that _Security_ attaches
      on _Draft Release_ completion) survive the rename. It runs after _Release Detailer_,
      well after _Security_, so the asset is already in place when the tag changes.
    - Run it by hand with `gh aw run release-versioner` (optionally with
      `-F dry_run=true` to log the decision without editing the draft, or `-F tag=<tag>`
      to target a specific draft).

4. **You review** the draft in the GitHub Releases UI — the tag is **already corrected**
   to the right SemVer version. Sanity-check it (and the Details), then publish; override
   the tag by hand only if you disagree with the classification.

5. **Publish Release** (`.github/workflows/publish-release.yml`, on `release: published`):
    - syncs `package.json` → `manifest.json` + `versions.json` to the published version
      (via `version-bump.mjs`),
    - builds and attaches `main.js`, `manifest.json`, `styles.css` to the release,
    - commits the synced version back to `main` (`chore(release): <version> [skip ci]`)
      so `manifest.json` on `main` always equals the latest release, and
    - moves the tag onto that commit.

    This sync-back is what avoids version conflicts: `main` never lags behind the tags,
    so the next draft computes cleanly and the community store sees a matching manifest.

## Provenance & verifying release assets

**Publish Release** attests the build provenance of the release binaries with
[`actions/attest-build-provenance`](https://github.com/actions/attest-build-provenance): it
records a signed attestation binding `main.js`, `manifest.json`, and `styles.css` to the
workflow run and commit that produced them. Anyone can verify a downloaded asset came from
this repository's CI (and was not tampered with) using the GitHub CLI:

```bash
gh attestation verify main.js --repo u-ways/obsidian-insert-path
```

The attestation is keyed by the file's SHA-256 digest, so it stays valid regardless of the
release tag, and it's stored in the repository's attestations rather than as a release asset.

## Version files

The version lives in **three** files kept in sync by `version-bump.mjs`:

| File            | Holds                                              |
| --------------- | -------------------------------------------------- |
| `package.json`  | the canonical version (the source the bump reads)  |
| `manifest.json` | the plugin version Obsidian reads                  |
| `versions.json` | a map of plugin version → minimum Obsidian version |

You don't edit these by hand for a release — the pipeline sets them from the published
tag. (`versions.json` alone is **not** the version; it's the version→minAppVersion map.)

## One-time setup

- **`COPILOT_GITHUB_TOKEN`** (repo secret) — required for the gh-aw agents (Release
  Detailer _and_ Release Versioner) on this repo (a token from a Copilot-licensed
  identity). Without it the draft is still created with native notes at the provisional
  patch version; only the AI `:bulb: Details` enrichment and the automatic SemVer
  re-tagging are skipped (you re-tag by hand, as before).
    - **No-PAT alternative (organisation repos only):** since
      [2026-06-11](https://github.blog/changelog/2026-06-11-agentic-workflows-no-longer-need-a-personal-access-token/)
      an **org-owned** repo can drop the PAT by setting `permissions: { copilot-requests: write }`
      in `release-detailer.md` and `release-versioner.md` (then recompile) — AI credits bill to the org, which must have
      centralised Copilot billing and the "Allow use of Copilot CLI billed to the organization"
      policy enabled. This repo is under a **user** account, so it uses the PAT above; transfer
      it to such an org to switch.
- **`RELEASE_AUTOMATION_TOKEN`** (repo secret) — needed because `main` has **required
  status checks** (this would also apply to _Require a pull request before merging_) that
  the built-in `github-actions[bot]` can't bypass on this user-owned repo. The publish job
  pushes the version-sync commit with this PAT, which is attributed to the admin owner and
  so bypasses the ruleset via its `RepositoryRole` admin bypass; without it the push falls
  back to `GITHUB_TOKEN` and the required checks block it. (An org-owned repo could instead
  bypass for the GitHub Actions app and drop the PAT.)
- **Actions permissions** — the workflows declare `contents: write` per job, so the default
  token suffices for drafting and uploading release assets; only the version-sync push-back
  to `main` needs the PAT above (because of the required checks).

## Editing the agents

Both `release-detailer` and `release-versioner` are gh-aw workflows. Their
`*.lock.yml` files are generated — never edit them by hand. Change the `.md`, then
recompile and commit **both** the `.md` and its `.lock.yml`:

```bash
gh extension install github/gh-aw    # once
gh aw compile release-versioner      # or release-detailer, or omit a name to compile all
git add .github/workflows/release-versioner.md .github/workflows/release-versioner.lock.yml
```

`gh aw validate` (schema, no codegen) and `gh aw lint` (actionlint) catch most mistakes
before they hit CI.

## Release-notes categories

`.github/release.yml` groups PRs in the native notes by label: `enhancement`/`feature`
→ ✨ Features, `bug`/`fix` → 🐛 Fixes, `dependencies` → ⬆️ Dependencies, everything else
→ 🔧 Changed. Label your PRs to control the changelog.
