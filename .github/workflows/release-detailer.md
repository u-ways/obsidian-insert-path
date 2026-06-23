---
name: Release Detailer
description: |
  Adds a user-facing ":bulb: Details" section to a freshly drafted GitHub
  release by reading the PRs and source-code changes that ship in the release
  and summarising what users of this Obsidian plugin need to know.

metadata:
  version: 0.1.0
  category: release
  owners: "u-ways"
  icon: 📝
  summary: "Enriches a draft release with a brief, user-focused ':bulb: Details' section generated from the included PRs and code diff."

on:
  workflow_run:
    workflows: ["Draft Release"]
    types: [completed]
    branches: [main]
  workflow_dispatch:
    inputs:
      tag:
        description: "Release tag to update (e.g. 0.1.1). Leave blank to use the latest draft."
        required: false
        type: string

permissions:
  contents: read
  pull-requests: read
  issues: read

timeout-minutes: 15
strict: false

jobs:
  discover_draft:
    name: 'Discover draft release'
    needs: pre_activation
    runs-on: ubuntu-latest
    permissions:
      contents: write
    timeout-minutes: 5
    outputs:
      found: ${{ steps.discover.outputs.found }}
      tag: ${{ steps.discover.outputs.tag }}
      body: ${{ steps.discover.outputs.body }}
    steps:
      - name: Discover draft release
        id: discover
        env:
          GH_TOKEN: ${{ github.token }}
          REPO: ${{ github.repository }}
          INPUT_TAG: ${{ inputs.tag }}
        run: |
          set -euo pipefail
          if [[ -n "${INPUT_TAG}" ]]; then
            tag="${INPUT_TAG}"
          else
            tag="$(gh release list --repo "${REPO}" --limit 20 \
              --json tagName,isDraft,createdAt \
              --jq 'map(select(.isDraft)) | sort_by(.createdAt) | reverse | .[0].tagName // ""')"
          fi
          if [[ -z "${tag}" ]]; then
            echo "No draft release found — nothing to do." >&2
            {
              echo "found=false"
              echo "tag="
              echo "body<<__GH_AW_EOF__"
              echo "__GH_AW_EOF__"
            } >> "$GITHUB_OUTPUT"
            exit 0
          fi
          body="$(gh release view "${tag}" --repo "${REPO}" --json body --jq .body)"
          {
            echo "found=true"
            echo "tag=${tag}"
            echo "body<<__GH_AW_EOF__"
            printf '%s\n' "${body}"
            echo "__GH_AW_EOF__"
          } >> "$GITHUB_OUTPUT"

network:
  allowed:
    - defaults
    - github

tools:
  github:
    toolsets: [default]
  bash:
    - "git log*"
    - "git diff*"
    - "git show*"
    - "git tag*"
    - "git rev-list*"
    - "gh pr view*"
    - "gh pr list*"
    - "cat"
    - "grep -r"
    - "find"

safe-outputs:
  jobs:
    update-draft-release:
      description: "Applies an enriched body to a draft GitHub release. The custom job validates that the agent emitted exactly one replacement body before editing the draft via gh release edit."
      runs-on: ubuntu-latest
      output: "Draft release update requested"
      permissions:
        contents: write
      inputs:
        tag:
          description: "The draft release tag to update."
          required: true
          type: string
        operation:
          description: "The release body operation. Must be replace."
          required: true
          type: string
        body:
          description: "The full release body to apply."
          required: true
          type: string
      steps:
        - name: Apply update to draft release
          env:
            GH_TOKEN: ${{ github.token }}
            REPO: ${{ github.repository }}
          run: |
            set -euo pipefail
            update_count="$(jq -r '
              (.items // [])
              | map(select(.type == "update_draft_release"))
              | length
            ' "${GH_AW_AGENT_OUTPUT}")"
            if [[ "${update_count}" == "0" ]]; then
              echo "No update_draft_release body in agent output — nothing to apply."
              exit 0
            fi
            if [[ "${update_count}" != "1" ]]; then
              echo "Expected exactly one update_draft_release output, found ${update_count}." >&2
              exit 1
            fi
            tag="$(jq -r '
              (.items // [])
              | map(select(.type == "update_draft_release"))
              | .[0].tag // ""
            ' "${GH_AW_AGENT_OUTPUT}")"
            operation="$(jq -r '
              (.items // [])
              | map(select(.type == "update_draft_release"))
              | .[0].operation // ""
            ' "${GH_AW_AGENT_OUTPUT}")"
            body="$(jq -r '
              (.items // [])
              | map(select(.type == "update_draft_release"))
              | .[0].body // ""
            ' "${GH_AW_AGENT_OUTPUT}")"
            if [[ -z "${tag}" ]]; then
              echo "update_draft_release output is missing tag." >&2
              exit 1
            fi
            if [[ "${operation}" != "replace" ]]; then
              echo "Expected update_draft_release operation 'replace', got '${operation}'." >&2
              exit 1
            fi
            if [[ -z "${body}" ]]; then
              echo "update_draft_release output is missing body." >&2
              exit 1
            fi
            printf '%s' "${body}" > /tmp/release-body.md
            echo "Applying enriched body to draft release tag: ${tag}"
            gh release edit "${tag}" \
              --repo "${REPO}" \
              --notes-file /tmp/release-body.md
            echo "Draft release updated successfully."

# gh-aw's built-in default model is claude-sonnet-4.6, which returns "400 model not
# supported" when it isn't enabled for the repo's COPILOT_GITHUB_TOKEN. Pin a broadly
# available model instead; switch to a supported Claude (e.g. claude-sonnet-4) if your
# Copilot plan offers it.
engine:
  id: copilot
  model: gpt-4o
---

# Release Detailer

You are a release-notes editor for the **`${{ github.repository }}`** repository — an **Obsidian plugin**. Your job is to enrich a freshly drafted GitHub release with a concise, user-facing **`:bulb: Details`** section so that someone who installs this plugin immediately understands *what they need to know about this version*.

"Users" here are people who install and use the plugin inside Obsidian — not other developers. Frame everything in terms of what they will see or do differently.

## Trigger context

You may be triggered in one of two ways:

- **`workflow_run`** completion of the `Draft Release` workflow — operate on the most recent **draft** release in `${{ github.repository }}`.
- **`workflow_dispatch`** — the user may supply a `tag` input. If supplied, target that tag; otherwise, fall back to the most recent draft release.

The pre-activation pipeline has already discovered the target draft for you and exposed it via the `discover_draft` job's outputs (you do **not** have permission to list/read draft releases yourself):

- **Target tag:** `${{ needs.discover_draft.outputs.tag }}`
- **Draft found:** `${{ needs.discover_draft.outputs.found }}`
- **Existing release body (verbatim):**

  ````
  ${{ needs.discover_draft.outputs.body }}
  ````

If `found` is not `true` (or the body block above is empty), exit gracefully without producing any `update_draft_release` output.

## What the section must look like

Key conventions:

1. The auto-generated `## What's Changed` section (and category subheadings such as `### ✨ Features`, `### 🐛 Fixes`, `### 🔧 Changed`, `### ⬆️ Dependencies`) **must remain untouched and on top**.
2. Insert a new section titled exactly `### :bulb: Details` immediately **after** the `## What's Changed` block and **before** the `**Full Changelog**: …` line.
3. Open with one short paragraph (1–3 sentences) that frames the release in plain English — *what changed for the user and why it matters*.
4. Follow with a tight bullet list using **bold lead-ins** (e.g. `- **Fuzzy search now highlights matches.** …`). Each bullet describes one user-visible behaviour change in 1–3 sentences.
5. Call out any **breaking changes** or **action required** explicitly (e.g. a renamed command, a changed default setting, a new required Obsidian version). Use a `#### Action required` subheading with a short note or fenced snippet showing what the user must do.
6. If there are no breaking changes, say so with a single sentence (e.g. *"No action required — the plugin updates in place and your settings are preserved."*).
7. Mention settings only if this release adds, removes, renames, or changes the behaviour of a setting.

Do **not** invent features. Every claim must be grounded in the PRs and diff you inspected.

## Process

1. **Identify the target release.** The `discover_draft` job already provides this — use `needs.discover_draft.outputs.tag` as the tag and `needs.discover_draft.outputs.body` as the verbatim current body. You **must** preserve the auto-generated content above your insertion point and the `**Full Changelog**` line below it byte-for-byte. Do **not** call `gh release list`, `gh release view`, `get_latest_release`, or `list_releases` to rediscover the draft — your token has read-only `contents` and those endpoints will hide drafts.

2. **Determine the version range.**
   - The body usually contains a `**Full Changelog**: https://github.com/<owner>/<repo>/compare/<base>...<head>` line — use that `<base>...<head>` as your range.
   - If absent, use the previous non-draft release tag as base and the draft's target commit (or tag) as head. Note tags are **not** v-prefixed (e.g. `0.1.0...0.1.1`).

3. **Gather signal.** Use the GitHub tools and read-only bash to:
   - List PRs merged in the range (`gh pr list --state merged --search "merged:>=<date>" ...`, or via `pull_request_read` / `search_pull_requests` on the PRs already linked in `## What's Changed`).
   - Read each PR's title, description, labels, and key file diffs (`pull_request_read` with method `get`, then `get_files` for the diff). Prioritise PRs already credited in `## What's Changed`.
   - Inspect the source diff between base and head with `git log <base>..<head> --oneline`, `git diff --stat <base>..<head>`, and `git show <sha>` for any commit that looks behaviour-changing.
   - Read top-level docs (`README.md`, `manifest.json`, `src/`) only when needed to phrase a user-facing description correctly — e.g. to name a command or setting exactly as it appears in the plugin.

4. **Synthesize the Details section.**
   - Focus on **user impact**: new or renamed commands, new/changed settings, fixed bugs, keyboard/preview/insertion behaviour changes, a bumped minimum Obsidian version, performance/UX improvements.
   - Skip pure refactors, internal test changes, lint/style fixes, and CI plumbing unless they alter what the user experiences.
   - Keep the whole section brief — aim for **under ~250 words**. Brevity beats completeness.
   - Use British English, sentence case in bullet lead-ins.

5. **Emit the update.**
   - Produce **exactly one** `update_draft_release` safe-output with `operation: "replace"` and a `body` equal to:
     - the original `## What's Changed` block (verbatim, including category subheadings and PR links), then
     - a blank line, then
     - the new `### :bulb: Details` section you authored, then
     - a blank line, then
     - the original `**Full Changelog**: …` line (verbatim).
   - Include the `tag` field set to the target release's tag.

   Output schema:
   ```json
   {
     "type": "update_draft_release",
     "tag": "<tag>",
     "operation": "replace",
     "body": "<full new body>"
   }
   ```

## Dependency updates

When a dependency bump includes a change likely to affect users (e.g. a behaviour change in `fzf`), call it out explicitly in the `### :bulb: Details` section. If the PR title or description does not explain the impact, inspect the dependency's release notes or the PR diff before describing it.

## Edge cases

- **Already has a Details section.** If the existing body already contains `### :bulb: Details`, regenerate it — replace that section in place rather than appending a second one. Use the latest signal from PRs/diff.
- **No meaningful user-facing changes** (e.g. release contains only dependency bumps or internal refactors). Still produce a Details section, but keep it to a single paragraph noting the maintenance refresh and that no action is required. Do not pad with filler.
- **Draft release not found.** Exit gracefully, emit no `update_draft_release` output.
- **Range cannot be determined.** Fall back to summarising whatever is listed in the existing `## What's Changed` block plus the linked PR descriptions.

## Guardrails

- Never modify the `## What's Changed` block or the `**Full Changelog**` line — preserve them byte-for-byte.
- Never add headings above `## What's Changed`.
- Never reference internal-only concerns (refactors, test scaffolding, internal tooling).
- Never speculate; if you cannot ground a statement in a PR or diff, omit it.
- Do not @-mention users beyond those already credited in `## What's Changed`.
- Do not include footers, signatures, or "generated by" notes.
