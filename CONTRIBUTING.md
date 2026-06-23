# Contributing

## Prerequisites

- Node.js 20+ (CI runs on 20 and 22)
- npm

```bash
npm install
```

## Architecture

The code is split so the bulk is testable without Obsidian:

- `src/core/**` and `src/types.ts` — **pure logic, zero `obsidian` imports.**
    - `walker.ts` — streaming directory walk (async generator over `fs.promises`).
    - `matcher.ts` — fuzzy matching via [`fzf`](https://github.com/ajitid/fzf-for-js).
    - `preview.ts` — directory-tree / file-head previews.
    - `recent.ts` — the recent-roots list.
    - `insert.ts` — the insertion-template expander.
- `src/ui/**` and `src/main.ts` — the thin Obsidian layer (modal, settings, plugin).

Keep new logic in `src/core` where possible. UI files use `import type` for
type-only Obsidian imports so the runtime layer stays minimal (this is also what
lets the test stub work — see below).

## Develop with live reload

1. Start the bundler in watch mode (writes `main.js` on every change):

    ```bash
    npm run dev
    ```

2. Point the linker at **your** Obsidian vault via the `DEFAULT_OBSIDIAN_VAULT`
   environment variable (there is no default — the script errors if it's unset).
   Export it once (e.g. in your shell profile) or prefix the command:

    ```bash
    export DEFAULT_OBSIDIAN_VAULT="$HOME/Documents/MyVault"   # your vault's absolute path
    npm run dev:link
    ```

    This links `manifest.json`, `main.js`, and `styles.css` into
    `<vault>/.obsidian/plugins/insert-path/` and writes an empty `.hotreload`
    marker. The plugin **id (`insert-path`) must match that folder name.**

3. Install **[Hot Reload](https://github.com/pjeby/hot-reload)** in the vault
   (it isn't a default plugin). With the `.hotreload` marker present, it reloads
   Insert Path automatically on every `npm run dev` rebuild.

4. In Obsidian, enable **Insert Path** (and **Hot Reload**) under
   **Settings → Community plugins**. The first enable is manual; after that, Hot
   Reload handles it.

Without Hot Reload you can reload manually with the **Reload app without saving**
command (or toggle the plugin off/on).

## Tests

```bash
npm test            # run once
npm run test:watch  # watch mode
npm run test:coverage
```

Tests run in plain Node (vitest):

- **Unit** (`test/unit`) — `insert`, `recent`, `matcher`.
- **Integration** (`test/integration`) — `walker` and `preview` build real
  temporary directory trees (`fs.mkdtemp`) and assert against real filesystem
  semantics (hidden files, symlinks, skip pruning). These are exactly the cases
  that differ between Linux and macOS, which is why CI runs the test job on both.

The UI files import `obsidian`, which only resolves inside Obsidian. `vitest`
aliases `obsidian` to a small stub (`test/mocks/obsidian.ts`); UI is kept thin
and only smoke-tested for importability.

## Quality gates (all run in CI)

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
```

Run `npm run format` to auto-fix formatting. Lint uses ESLint + typescript-eslint
with a rule banning raw HTML injection (`innerHTML`/`outerHTML`/`insertAdjacentHTML`)
to honour Obsidian's DOM guidelines — build nodes with `createEl`/`createDiv`/
`createSpan` and `empty()`.

> CI must be green before a PR is merged. Enable branch protection with the
> `quality` and `test` checks as required status checks in the repository
> settings (this can't be configured from committed files).

## Releasing

Releases are automated: merging to `main` recreates a draft release, an agentic
"Release Detailer" workflow enriches it, and publishing it attaches the build assets
and syncs the version back to `main`. You don't bump versions by hand. See
[docs/RELEASING.md](RELEASING.md) for the full lifecycle, required secrets
(`COPILOT_GITHUB_TOKEN`, optionally `RELEASE_AUTOMATION_TOKEN`), and how to edit the
agentic workflow (`gh aw compile`).
