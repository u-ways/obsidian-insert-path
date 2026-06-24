---
name: Release Versioner
description: |
  Decides whether a freshly drafted GitHub release should be a patch, minor, or
  major (breaking) version per SemVer — by reading the PRs and source-code changes
  that ship in it — and auto-edits the draft's tag and title so that publishing it
  produces the correct version. Runs right after "Release Detailer".

metadata:
  version: 0.1.0
  category: release
  owners: "u-ways"
  icon: 🔖
  summary: "Classifies a draft release as patch/minor/major from its PRs + diff and re-tags the draft so Publish yields the correct SemVer version."

on:
  workflow_run:
    workflows: ["Release Detailer"]
    types: [completed]
    branches: [main]
  workflow_dispatch:
    inputs:
      tag:
        description: "Draft release tag to re-version (e.g. 0.1.4). Leave blank to use the latest draft."
        required: false
        type: string
      dry_run:
        description: "When true, log the decision and target version but do NOT edit the draft."
        required: false
        default: false
        type: boolean

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
      base: ${{ steps.discover.outputs.base }}
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
          if [[ -n "${INPUT_TAG:-}" ]]; then
            tag="${INPUT_TAG}"
          else
            tag="$(gh release list --repo "${REPO}" --limit 30 \
              --json tagName,isDraft,createdAt \
              --jq 'map(select(.isDraft)) | sort_by(.createdAt) | reverse | .[0].tagName // ""')"
          fi
          # Latest PUBLISHED semver release (drafts excluded) — the version the bump is applied to.
          base="$(gh release list --repo "${REPO}" --limit 100 \
            --json tagName,isDraft \
            --jq '.[] | select(.isDraft | not) | .tagName' \
            | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -n 1 || true)"
          if [[ -z "${tag}" ]]; then
            echo "No draft release found — nothing to do." >&2
            {
              echo "found=false"
              echo "tag="
              echo "base=${base}"
              echo "body<<__GH_AW_EOF__"
              echo "__GH_AW_EOF__"
            } >> "$GITHUB_OUTPUT"
            exit 0
          fi
          body="$(gh release view "${tag}" --repo "${REPO}" --json body --jq .body)"
          {
            echo "found=true"
            echo "tag=${tag}"
            echo "base=${base}"
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
    apply-version-decision:
      description: "Re-tags a draft GitHub release to the SemVer-correct version. The custom job validates that the agent emitted exactly one decision, recomputes the target version deterministically from the latest published release, and only ever edits a draft (never a published release)."
      runs-on: ubuntu-latest
      output: "Version decision applied"
      permissions:
        contents: write
      inputs:
        tag:
          description: "The draft release tag the decision was made against."
          required: true
          type: string
        bump:
          description: "The SemVer bump level. Must be one of: patch, minor, major."
          required: true
          type: string
        reasoning:
          description: "A short (1-3 sentence) justification for the chosen bump, grounded in the PRs/diff."
          required: true
          type: string
      steps:
        - name: Apply version decision to draft release
          env:
            GH_TOKEN: ${{ github.token }}
            REPO: ${{ github.repository }}
            INPUT_TAG: ${{ inputs.tag }}
            DRY_RUN: ${{ inputs.dry_run }}
          run: |
            set -euo pipefail

            # ---- 1. Validate the agent emitted exactly one decision -------------------------
            decisions="$(jq -c '(.items // []) | map(select(.type == "apply_version_decision"))' "${GH_AW_AGENT_OUTPUT}")"
            count="$(jq 'length' <<< "${decisions}")"
            if [[ "${count}" == "0" ]]; then
              echo "No apply_version_decision in agent output — nothing to do."
              exit 0
            fi
            if [[ "${count}" != "1" ]]; then
              echo "Expected exactly one apply_version_decision output, found ${count}." >&2
              exit 1
            fi
            bump="$(jq -r '.[0].bump // ""' <<< "${decisions}")"
            reasoning="$(jq -r '.[0].reasoning // ""' <<< "${decisions}")"
            agent_tag="$(jq -r '.[0].tag // ""' <<< "${decisions}")"
            case "${bump}" in
              patch|minor|major) ;;
              *) echo "Invalid bump value '${bump}' (expected patch|minor|major)." >&2; exit 1 ;;
            esac
            # Clamp the LLM-controlled reasoning before it reaches the step summary: strip
            # newlines and cap length so injected PR content can't spoof extra summary lines.
            reasoning="${reasoning//$'\n'/ }"
            reasoning="${reasoning:0:500}"

            # ---- 2. Resolve which draft to re-version (deterministically) ------------------
            #    explicit workflow_dispatch tag, else the latest draft. The agent's echoed tag
            #    is advisory only (logged below) — the mutation target is never taken from the
            #    model, so a hallucinated tag cannot redirect the edit.
            current="${INPUT_TAG:-}"
            if [[ -z "${current}" ]]; then
              current="$(gh release list --repo "${REPO}" --limit 30 \
                --json tagName,isDraft,createdAt \
                --jq 'map(select(.isDraft)) | sort_by(.createdAt) | reverse | .[0].tagName // ""')"
            fi
            if [[ -z "${current}" ]]; then
              echo "No draft release found — nothing to do."
              exit 0
            fi
            if [[ -n "${agent_tag}" && "${agent_tag}" != "${current}" ]]; then
              echo "::warning::Agent classified tag '${agent_tag}' but the draft to re-version is '${current}' — using '${current}'."
            fi
            if [[ ! "${current}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
              echo "Draft tag '${current}' is not X.Y.Z semver — refusing to re-version." >&2
              exit 1
            fi

            # ---- 3. Guard: only ever edit a DRAFT release ----------------------------------
            is_draft="$(gh release view "${current}" --repo "${REPO}" --json isDraft --jq .isDraft 2>/dev/null || echo "")"
            if [[ "${is_draft}" != "true" ]]; then
              echo "Release '${current}' is not a draft (isDraft='${is_draft}') — refusing to edit a published release." >&2
              exit 1
            fi

            # ---- 4. Base = latest PUBLISHED semver release ---------------------------------
            #    Mirrors draft-release.yml, which derives the next version from the latest tag
            #    (= latest published release, since draft tags are not git refs until publish).
            base="$(gh release list --repo "${REPO}" --limit 100 \
              --json tagName,isDraft \
              --jq '.[] | select(.isDraft | not) | .tagName' \
              | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -n 1 || true)"
            if [[ -z "${base}" ]]; then
              echo "No published semver release found — leaving draft '${current}' unchanged."
              exit 0
            fi

            # ---- 5. Map bump -> target version ---------------------------------------------
            #    Standard SemVer mapping. PRE-1.0 POLICY: while this plugin is 0.y.z, a `major`
            #    (breaking) decision jumps to 1.0.0. To instead keep breaking changes inside
            #    0.x until you deliberately cut a stable 1.0, change the `major)` arm to:
            #        target="${major}.$((10#${minor} + 1)).0"
            #    (10# forces base-10 so a component like 08/09 can't trip octal parsing under set -e.)
            IFS='.' read -r major minor patch <<< "${base}"
            case "${bump}" in
              major) target="$((10#${major} + 1)).0.0" ;;
              minor) target="${major}.$((10#${minor} + 1)).0" ;;
              patch) target="${major}.${minor}.$((10#${patch} + 1))" ;;
            esac

            echo "::notice title=Version decision::published=${base} bump=${bump} -> target=${target} (current draft ${current})"
            {
              echo "### 🔖 Release Versioner"
              echo ""
              echo "| Field | Value |"
              echo "| --- | --- |"
              echo "| Latest published | \`${base}\` |"
              echo "| Current draft tag | \`${current}\` |"
              echo "| Decision | \`${bump}\` |"
              echo "| Target tag | \`${target}\` |"
              echo ""
              echo "**Reasoning:** ${reasoning}"
            } >> "${GITHUB_STEP_SUMMARY}"

            # ---- 6. Apply (unless already correct or a dry run) ----------------------------
            if [[ "${target}" == "${current}" ]]; then
              echo "::notice::Draft already tagged ${current} (matches the ${bump} bump) — no change needed."
              exit 0
            fi
            if [[ "${DRY_RUN:-}" == "true" ]]; then
              echo "::notice title=Dry run::Would re-tag draft ${current} -> ${target} and fix the compare link. No changes applied."
              exit 0
            fi

            # Re-tag the draft + title, and fix the "**Full Changelog**" compare link by
            # rewriting every "...<current>" occurrence to "...<target>" (in a normal release
            # body only the compare link's head tag matches). `gh release edit` preserves the
            # release body and any attached assets (e.g. the SBOM).
            body="$(gh release view "${current}" --repo "${REPO}" --json body --jq .body)"
            if [[ -z "${body}" || "${body}" == "null" ]]; then
              # No body to preserve — rename tag + title only. Never pass an empty --notes-file,
              # which would blank an existing release body.
              echo "::warning::Draft ${current} has no body — re-tagging without rewriting notes."
              gh release edit "${current}" --repo "${REPO}" --tag "${target}" --title "${target}"
            else
              body="${body//...${current}/...${target}}"
              printf '%s' "${body}" > /tmp/versioned-body.md
              gh release edit "${current}" \
                --repo "${REPO}" \
                --tag "${target}" \
                --title "${target}" \
                --notes-file /tmp/versioned-body.md
            fi
            echo "::notice title=Draft re-tagged::${current} -> ${target}"

# gh-aw's built-in default model is claude-sonnet-4.6, which returns "400 model not
# supported" when it isn't enabled for the repo's COPILOT_GITHUB_TOKEN. Pin a broadly
# available model instead; switch to a supported Claude (e.g. claude-sonnet-4) if your
# Copilot plan offers it.
engine:
  id: copilot
  model: gpt-4o
---

# Release Versioner

You are a release **version classifier** for the **`${{ github.repository }}`** repository — an **Obsidian plugin**. Your single job is to decide whether the freshly drafted release should be a **patch**, **minor**, or **major** version under [Semantic Versioning](https://semver.org/spec/v0.1.0.html), based on what actually ships in it, and to emit that decision. A deterministic downstream job will recompute the exact version number and re-tag the draft for you — **you do not compute version numbers or edit the release yourself.**

"Users" here are people who install and use the plugin inside Obsidian. Judge compatibility from *their* perspective: a change is "breaking" if a user upgrading in place would experience different or broken behaviour without taking action.

## Trigger context

You may be triggered in one of two ways:

- **`workflow_run`** completion of the `Release Detailer` workflow — operate on the most recent **draft** release in `${{ github.repository }}`.
- **`workflow_dispatch`** — the user may supply a `tag` input. If supplied, target that tag; otherwise, fall back to the most recent draft release.

The pre-activation pipeline has already discovered the target draft for you and exposed it via the `discover_draft` job's outputs (you do **not** have permission to list/read draft releases yourself):

- **Target tag (current, provisional):** `${{ needs.discover_draft.outputs.tag }}`
- **Latest published version (base):** `${{ needs.discover_draft.outputs.base }}`
- **Draft found:** `${{ needs.discover_draft.outputs.found }}`
- **Current release body (verbatim):**

  ````
  ${{ needs.discover_draft.outputs.body }}
  ````

If `found` is not `true` (or the body block above is empty), exit gracefully without emitting any `apply_version_decision` output.

> The current draft tag is only a **provisional patch bump** computed by the `Draft Release` workflow — it is *not* evidence of the correct bump. Your decision determines the real version.

## SemVer rules to apply

Classify the release by the **single highest-impact change** it contains (a release with one breaking change is `major` even if everything else is a fix; a release with a new feature and some fixes is `minor`):

- **`major`** — a **backwards-incompatible** change to the plugin's public behaviour. For this plugin that includes: removing or renaming a command, hotkey, or setting; changing the default value or meaning of a setting in a way that alters existing users' behaviour; changing the format of stored settings/data so existing configs need migration; raising `minAppVersion` so previously-supported Obsidian versions can no longer run the plugin; removing a previously-working capability.
- **`minor`** — new **backwards-compatible** functionality: a new command, setting, option, or user-visible capability that does not break anything existing.
- **`patch`** — backwards-compatible **bug fixes**, performance work, refactors, docs, tests, CI/build plumbing, and dependency bumps that do not change user-facing behaviour.

Apply these tie-breakers so the decision is evidence-driven, not speculative:

1. Only choose **`major`** when you can point to a **concrete, identified backwards-incompatible change** in a PR or diff. Do not infer "breaking" from a version number, a PR title alone, or vague wording. (A `major` decision here means the plugin jumps to `1.0.0`, a deliberate stability signal — so require real evidence.)
2. Choose **`minor`** when there is a genuine new user-facing capability but nothing breaking.
3. Otherwise choose **`patch`**. If a release contains only dependency bumps, refactors, or CI/test changes, it is `patch`.

## Process

1. **Confirm the target.** Use `needs.discover_draft.outputs.tag` as the current (provisional) draft tag and `needs.discover_draft.outputs.base` as the latest published version. Do **not** call `gh release list`, `gh release view`, `get_latest_release`, or `list_releases` to rediscover the draft — your token has read-only `contents` and those endpoints will hide drafts.

2. **Determine the version range.**
   - The body usually contains a `**Full Changelog**: https://github.com/<owner>/<repo>/compare/<base>...<head>` line — use that `<base>...<head>` as your range.
   - If absent, use the latest published release tag (`base` above) as the base and the draft's target commit (or tag) as the head. Note tags are **not** `v`-prefixed (e.g. `0.1.3...0.1.4`).

3. **Gather signal.** Inspect what actually changed, primarily via the **GitHub MCP tools** (they work regardless of checkout):
   - Read the PRs listed under `## What's Changed` in the body (`pull_request_read` with method `get`, then `get_files` for the diff), prioritising their titles, descriptions, labels, and key file diffs. This is your main source of evidence.
   - Read `manifest.json` (for `minAppVersion`), `src/`, and `README.md` only as needed to judge whether a change is breaking, a new capability, or internal — e.g. to confirm a setting was renamed/removed or a command added.
   - The agent's local checkout is **shallow and has no tags**, so `git log/diff/show <base>..<head>` over the release range will usually fail — treat them as a best-effort supplement only, and rely on the PR data above when they do.

4. **Decide the bump.** Apply the SemVer rules and tie-breakers above to the evidence. Pick exactly one of `patch`, `minor`, `major`.

5. **Emit the decision.** Produce **exactly one** `apply_version_decision` safe-output:

   ```json
   {
     "type": "apply_version_decision",
     "tag": "<the current draft tag from discover_draft.outputs.tag>",
     "bump": "patch | minor | major",
     "reasoning": "<1-3 sentences citing the specific PR(s)/change(s) that drove the decision>"
   }
   ```

   - Set `tag` to the current provisional draft tag exactly as given by `discover_draft.outputs.tag` (the downstream job uses it to locate the draft).
   - Set `bump` to your single classification.
   - Keep `reasoning` short, specific, and grounded — name the PR number(s) or change(s). British English.

## Edge cases

- **Draft not found / body empty.** Exit gracefully and emit no `apply_version_decision` output.
- **Only dependency bumps, refactors, CI/test/build changes.** That is a `patch` — emit `patch`, do not pad the reasoning.
- **Range cannot be determined.** Fall back to classifying from whatever is listed in `## What's Changed` plus the linked PR descriptions, and say so in `reasoning`.
- **Genuinely ambiguous between two levels.** Prefer the lower bump unless you have concrete evidence for the higher one (per the tie-breakers). The maintainer reviews the draft before publishing.

## Guardrails

- Emit **exactly one** `apply_version_decision`, or none (only when no draft/body is available).
- Decide **only** the bump level — never compute the resulting version number, never call `gh release edit`, and never attempt to publish.
- Never classify as `major` without a concrete, identified backwards-incompatible change.
- Never speculate; if you cannot ground a claim in a PR or diff, do not rely on it.
- Do not modify the release body, the `## What's Changed` block, or the `**Full Changelog**` line — the downstream job handles any edits.
- Do not @-mention users, and do not include footers, signatures, or "generated by" notes in `reasoning`.
