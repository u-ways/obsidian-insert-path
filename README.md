# Insert Path

Fuzzy-find any file or directory anywhere under a root (default: your home
folder) from inside Obsidian, preview it, and insert its path at the cursor.

It brings the muscle memory of shell fuzzy finders (`fzf`, `ff`/`fff`) into the
editor — without leaving Obsidian to open a terminal, `pwd`, and paste a path
back into a note.

> **Desktop only.** Insert Path walks your filesystem with Node APIs, so it does
> not run on Obsidian mobile.

## Why

Dropping a real filesystem path into a note normally means: open a terminal,
fuzzy-find the directory, copy the path, switch back, paste. Insert Path does
the fuzzy-find in a modal and inserts the result where your cursor already is.

It has **no external dependencies** — no `fzf`, `eza`, `bat`, or `fd` binaries.
Walking and previews use Node's `fs`; fuzzy matching uses
[fzf-for-js](https://github.com/ajitid/fzf-for-js), bundled into the plugin.

## Features

- **Two commands** — _Insert directory path_ and _Insert file path_ — plus a
  `Tab` toggle to switch mode inside the picker.
- **Live fuzzy match** with highlighted match positions and a moving selection.
- **Preview pane** — a 2-level directory tree, or the head of a file.
- **Root switching** (`Ctrl/Cmd+O`): jump to home, the vault root, a recent root
  (the last 5 are remembered), or type/paste a custom path.
- **Configurable insertion** — a template decides what gets inserted.
- Paths are shown **relative** to the root but inserted as **absolute** paths.

## Usage

1. Place your cursor in a note.
2. Run **Insert Path: Insert directory path** (or **…file path**) from the
   command palette, or bind a hotkey under **Settings → Hotkeys**. (If you use
   the [Doubleshift](https://github.com/Qwyntex/doubleshift) plugin, you can map
   shift-shift to either command.)
3. Type to filter; the preview updates as you move the selection.
4. Press **Enter** to insert the path at the cursor.

| Key          | Action                          |
| ------------ | ------------------------------- |
| `↑` / `↓`    | Move selection                  |
| `Ctrl+N/P`   | Move selection (readline-style) |
| `Enter`      | Insert the selected path        |
| `Tab`        | Toggle directory / file mode    |
| `Ctrl/Cmd+O` | Change the search root          |
| `Esc`        | Close                           |

## Settings

| Setting            | Default                      | Notes                                                                 |
| ------------------ | ---------------------------- | --------------------------------------------------------------------- |
| Default root       | your home folder             | Where the picker starts.                                              |
| Insertion template | `{path}`                     | Tokens: `{path}` (absolute), `{name}` (basename), `{rel}` (relative). |
| Skip directories   | `.git, node_modules, .cache` | Comma-separated directory names pruned while walking.                 |
| Follow symlinks    | on                           | Symlink cycles are handled safely.                                    |
| Include hidden     | on                           | Include dot-files and dot-directories.                                |
| Max results        | `10000`                      | A notice appears if the walk is truncated.                            |

**Insertion template examples**

| Template           | Inserts                           |
| ------------------ | --------------------------------- |
| `{path}`           | `/home/you/projects/docs`         |
| `` `{path}` ``     | `` `/home/you/projects/docs` ``   |
| `[{name}]({path})` | `[docs](/home/you/projects/docs)` |

## Limitations

- Desktop only (Obsidian ≥ 1.4.0).
- The file preview is plain monospace text (no syntax highlighting).
- The commands require an active editor — they insert at the cursor.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for the dev environment, the vault live-reload
workflow, and how to run the tests.

## License

[MIT](LICENSE)
