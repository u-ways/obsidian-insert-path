// Syntax highlighting via Obsidian's OWN bundled Prism.
//
// `loadPrism()` resolves to the SAME global Prism instance that Obsidian's
// reading-mode code blocks use, so highlighting emits the standard `.token.*`
// spans that the user's active theme (and any community highlighting CSS) already
// styles — no external highlighter dependency, and the preview matches what the
// user sees in their reading view.
//
// IMPORTANT: this module must only READ from Prism (`Prism.languages[lang]`,
// `Prism.highlightElement`). It must NEVER register grammars or hooks: the
// instance is shared with reading mode, so any mutation would leak into the
// user's real code-block rendering.

import { loadPrism } from "obsidian";
import type { FilePreview } from "./preview";

/** The minimal slice of Prism's surface we consume (read-only). */
interface Prism {
	languages: Record<string, unknown>;
	highlightElement(element: Element): void;
}

let prismPromise: Promise<Prism | null> | null = null;

/**
 * Resolve Obsidian's bundled Prism exactly once and cache the promise. Never
 * throws to the caller: if Prism is unavailable the promise resolves to `null`
 * and highlighting is skipped (the preview falls back to plain monospace text).
 */
export function getPrism(): Promise<Prism | null> {
	return (prismPromise ??= loadPrism()
		.then((p: unknown) => p as Prism)
		.catch(() => null));
}

// File extension -> Prism language id. The guard `Prism.languages[lang]` in the
// caller means an id absent from this Obsidian build simply degrades to plain
// text, so being generous here is safe. Only map to ids Prism actually defines.
const EXT_TO_PRISM: Record<string, string> = {
	ts: "typescript",
	mts: "typescript",
	cts: "typescript",
	tsx: "tsx",
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	jsx: "jsx",
	json: "json",
	jsonc: "json",
	jsonl: "json",
	py: "python",
	pyi: "python",
	rb: "ruby",
	rs: "rust",
	go: "go",
	java: "java",
	kt: "kotlin",
	kts: "kotlin",
	scala: "scala",
	groovy: "groovy",
	gradle: "groovy",
	c: "c",
	h: "c",
	cpp: "cpp",
	cc: "cpp",
	cxx: "cpp",
	hpp: "cpp",
	hh: "cpp",
	cs: "csharp",
	fs: "fsharp",
	swift: "swift",
	m: "objectivec",
	mm: "objectivec",
	dart: "dart",
	sh: "bash",
	bash: "bash",
	zsh: "bash",
	fish: "bash",
	ps1: "powershell",
	bat: "batch",
	cmd: "batch",
	yaml: "yaml",
	yml: "yaml",
	toml: "toml",
	ini: "ini",
	cfg: "ini",
	conf: "ini",
	css: "css",
	scss: "scss",
	sass: "sass",
	less: "less",
	html: "markup",
	htm: "markup",
	xml: "markup",
	svg: "markup",
	vue: "markup",
	md: "markdown",
	markdown: "markdown",
	sql: "sql",
	php: "php",
	lua: "lua",
	pl: "perl",
	pm: "perl",
	r: "r",
	ex: "elixir",
	exs: "elixir",
	erl: "erlang",
	clj: "clojure",
	hs: "haskell",
	ml: "ocaml",
	jl: "julia",
	diff: "diff",
	patch: "diff",
	graphql: "graphql",
	gql: "graphql",
	proto: "protobuf",
	tf: "hcl",
	hcl: "hcl",
};

// Well-known extensionless filenames that still have a grammar.
const NAME_TO_PRISM: Record<string, string> = {
	dockerfile: "docker",
	makefile: "makefile",
};

/**
 * Map a file path to a Prism language id, derived ONLY from its filename (never
 * from file content). Returns `null` for dotfiles, extensionless files, and
 * unknown extensions — the caller then renders plain text.
 */
export function prismLangFor(absPath: string): string | null {
	const base = absPath.slice(absPath.lastIndexOf("/") + 1).toLowerCase();
	const named = NAME_TO_PRISM[base];
	if (named) return named;
	const dot = base.lastIndexOf(".");
	// `dot > 0` so dotfiles (".gitignore") have no extension and stay plain.
	const ext = dot > 0 ? base.slice(dot + 1) : "";
	return EXT_TO_PRISM[ext] ?? null;
}

export interface HighlightLimits {
	/** Max on-disk file size to highlight, in bytes. `0` = no size limit. */
	maxHighlightBytes: number;
	/** Max length of any single line in the head before skipping. `0` = no line limit. */
	maxHighlightLineLength: number;
}

/**
 * Decide whether a file preview should be syntax-highlighted. Returns `false`
 * (-> plain monospace) for binary/unreadable previews, files larger than the
 * size limit, or heads containing a very long line (e.g. minified code) — which
 * would make synchronous, main-thread highlighting janky. The binary/error
 * checks come first: this is the boundary that keeps NUL/binary content out of
 * the tokenizer, so it must run before any language lookup or Prism call.
 */
export function shouldHighlight(file: FilePreview, limits: HighlightLimits): boolean {
	if (file.binary || file.error) return false;
	if (limits.maxHighlightBytes > 0 && file.size > limits.maxHighlightBytes) return false;
	if (
		limits.maxHighlightLineLength > 0 &&
		hasLongLine(file.text, limits.maxHighlightLineLength)
	) {
		return false;
	}
	return true;
}

/** True if any line in `text` is longer than `max` characters. */
function hasLongLine(text: string, max: number): boolean {
	let lineStart = 0;
	for (let i = 0; i < text.length; i++) {
		if (text.charCodeAt(i) === 10 /* \n */) {
			if (i - lineStart > max) return true;
			lineStart = i + 1;
		}
	}
	return text.length - lineStart > max;
}
