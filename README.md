# Insert Path (Plugin)

<p align="center">
  <a href="https://obsidian.md/"><img src="https://img.shields.io/badge/Obsidian-%23483699?logo=obsidian&logoColor=white" alt="Obsidian"></a>&nbsp;
  <a href="https://github.com/u-ways/obsidian-insert-path/releases/latest"><img src="https://img.shields.io/github/v/release/u-ways/obsidian-insert-path?sort=semver&label=release" alt="Release"></a>&nbsp;
  <a href="https://github.com/u-ways/obsidian-insert-path/actions/workflows/ci.yml"><img src="https://github.com/u-ways/obsidian-insert-path/actions/workflows/ci.yml/badge.svg" alt="CI"></a>&nbsp;
  <a href="https://github.com/u-ways/obsidian-insert-path/actions/workflows/security.yml"><img src="https://github.com/u-ways/obsidian-insert-path/actions/workflows/security.yml/badge.svg" alt="Security"></a>&nbsp;
  <a href="LICENSE"><img alt="GitHub License" src="https://img.shields.io/github/license/u-ways/obsidian-insert-path?color=blue"></a>
</p>

<p align="center">
  <img src="docs/quick-demo.gif" alt="Insert Path demo" />
</p>

Fuzzy-find any file or directory anywhere under a root (default: your home
folder) from inside Obsidian, preview it, and insert its path at the cursor.

## Why

For me, dropping a real filesystem path into a note normally means:

1. Open a terminal,
2. Fuzzy-find the directory,
3. Copy the path,
4. Switch back,
5. Paste.

Insert Path does the fuzzy-find in a modal and inserts the result where your cursor already is, a seamless user experience.
It brings the muscle memory of shell fuzzy finders into the editor, without leaving Obsidian.

## Features

- **Two commands**: _Insert directory path_ and _Insert file path_. (+ a `Tab` toggle to switch mode inside the picker)
- **Live fuzzy match** with highlighted match positions and a moving selection.
- **Preview pane**: a directory tree (depth configurable, default 2), or the head
  of a file with syntax highlighting (using Obsidian's own renderer, so it matches
  your theme).
- **Resizable split**: drag the divider between the results list and the preview
  to find your sweet spot; the position is remembered across sessions
  (double-click the divider to reset it to 50/50).
- **Root switching** (`Ctrl/Cmd+O`): jump to home, the vault root, a recent root (the last 5 are remembered), or type/paste a custom path.
- **Configurable insertion**: a template decides what gets inserted.

On top of that, it has **no external dependencies**, no `fzf`, `eza`, `bat`, or `fd` binaries.
Walking and previews use Node's `fs`; fuzzy matching uses [fzf-for-js](https://github.com/ajitid/fzf-for-js), bundled into the plugin.

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

| Setting              | Default                      | Notes                                                                            |
| -------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| Default root         | your home folder             | Where the picker starts.                                                         |
| Insertion template   | `{path}`                     | Tokens: `{path}` (absolute), `{name}` (basename), `{rel}` (relative).            |
| Skip directories     | `.git, node_modules, .cache` | Comma-separated directory names pruned while walking.                            |
| Directory tree depth | `2`                          | How many levels deep the directory preview tree descends.                        |
| Follow symlinks      | on                           | Symlink cycles are handled safely.                                               |
| Include hidden       | on                           | Include dot-files and dot-directories.                                           |
| Max results          | `10000`                      | A notice appears if the walk is truncated.                                       |
| Highlight size cap   | `1024` KB                    | Files larger than this preview as plain text. `0` disables the limit.            |
| Highlight line cap   | `5000` chars                 | Skip highlighting when a line is longer than this (e.g. minified). `0` disables. |

**Insertion template examples**

Below are some examples of how the insertion template works:

| Template           | Inserts                           |
| ------------------ | --------------------------------- |
| `{path}`           | `/home/you/projects/docs`         |
| `` `{path}` ``     | `` `/home/you/projects/docs` ``   |
| `[{name}]({path})` | `[docs](/home/you/projects/docs)` |

So if you want to insert a Markdown link to the selected file, you can use `[{name}]({path})` as the template.

## Limitations

- Desktop only (Obsidian ≥ 1.4.0).
- File previews are syntax-highlighted via Obsidian's own renderer (your active
  theme's colors). Files with no recognized extension, binaries, and files over
  the configurable size/line caps fall back to plain monospace text.
- The commands require an active editor — they insert at the cursor.
- Tested with Ubuntu & macOS only.

## Development

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for the dev environment, the vault live-reload
workflow, and how to run the tests.

## License

See [MIT](LICENSE) licence.
