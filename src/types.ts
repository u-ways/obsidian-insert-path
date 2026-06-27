import * as os from "os";

export type WalkMode = "dir" | "file";

/** The two things the picker can do with the selected entry. */
export type PrimaryAction = "insert" | "open";

export interface WalkEntry {
	/** Absolute path to the entry. */
	abs: string;
	/** Path relative to the walk root, POSIX-normalized for display. */
	rel: string;
}

export interface WalkOptions {
	/** Directory to start walking from. */
	root: string;
	/** Whether to emit directories or files. */
	mode: WalkMode;
	/** Follow symlinked directories (with cycle protection). */
	followSymlinks: boolean;
	/** Include dot-files and dot-directories. */
	includeHidden: boolean;
	/** Directory basenames to prune, e.g. [".git", "node_modules", ".cache"]. */
	skip: string[];
	/** Stop after emitting this many entries (then report `truncated: true`). */
	cap: number;
	/** Abort the walk early (e.g. the user changed root/mode or closed the modal). */
	signal: AbortSignal;
}

/** Outcome returned by the walker generator once iteration completes. */
export interface WalkResult {
	truncated: boolean;
}

export interface PathPickerSettings {
	/** Root the picker starts from (default: the user's home directory). */
	defaultRoot: string;
	/** Template for the inserted text. Tokens: {path}, {name}, {rel}. */
	insertionTemplate: string;
	/**
	 * Which action Enter / click trigger without a modifier; the modifier (Alt) always
	 * runs the other. "insert" (default) inserts the path and Alt opens; "open" flips it.
	 */
	primaryAction: PrimaryAction;
	/** Most-recently-used roots, most-recent first. */
	recentRoots: string[];
	/** Comma-separated directory names to prune during the walk. */
	skip: string;
	followSymlinks: boolean;
	includeHidden: boolean;
	/** Cap on walked entries before truncation (guards against huge trees). */
	maxResults: number;
	/** How many levels deep the directory-preview tree descends (default 2). */
	treeDepth: number;
	/** Rainbow-colour the directory-preview tree by nesting depth (default true). */
	colorizeTree: boolean;
	/** Max on-disk file size to syntax-highlight, in bytes. 0 disables the size limit. */
	maxHighlightBytes: number;
	/**
	 * Skip syntax-highlighting when the preview head contains a line longer than this
	 * many characters (e.g. minified files), keeping highlighting fast. 0 disables it.
	 */
	maxHighlightLineLength: number;
	/**
	 * Width of the results pane as a fraction (0–1) of the picker body; the rest goes
	 * to the preview. Set by dragging the divider between the two panes, and persisted.
	 */
	splitRatio: number;
}

/** How many recent roots to remember. */
export const RECENT_ROOTS_LIMIT = 5;

export const DEFAULT_SETTINGS: PathPickerSettings = {
	defaultRoot: os.homedir(),
	insertionTemplate: "{path}",
	primaryAction: "insert",
	recentRoots: [],
	skip: ".git, .svn, .hg, .bzr, node_modules, bower_components, .next, .nuxt, .svelte-kit, .astro, .angular, .vite, .turbo, .parcel-cache, .docusaurus, .expo, .vercel, .netlify, .yarn, .pnpm-store, .output, __pycache__, .venv, venv, .mypy_cache, .pytest_cache, .ruff_cache, .tox, .nox, .eggs, .hypothesis, .ipynb_checkpoints, __pypackages__, .bundle, vendor, target, dist, build, out, obj, coverage, htmlcov, .nyc_output, _site, .jekyll-cache, Pods, DerivedData, Carthage, .dart_tool, .gradle, .terraform, .sass-cache, .serverless, .vagrant, __MACOSX, .idea, .vscode, .cache",
	followSymlinks: true,
	includeHidden: true,
	maxResults: 10000,
	treeDepth: 2,
	colorizeTree: true,
	maxHighlightBytes: 1024 * 1024,
	maxHighlightLineLength: 5000,
	splitRatio: 0.5,
};

/** Bounds for the results/preview split so neither pane can be collapsed away. */
export const SPLIT_MIN = 0.2;
export const SPLIT_MAX = 0.8;
export const SPLIT_DEFAULT = 0.5;

/** Clamp a results-pane width fraction to a usable range (falling back to the default). */
export function clampSplitRatio(ratio: number): number {
	if (!Number.isFinite(ratio)) return SPLIT_DEFAULT;
	return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, ratio));
}

/**
 * Resolve which action a key or click triggers: the configured primary action when no
 * modifier is held, or the other action when the modifier (Alt) is held.
 */
export function resolveAction(primary: PrimaryAction, withModifier: boolean): PrimaryAction {
	if (!withModifier) return primary;
	return primary === "insert" ? "open" : "insert";
}

/** Parse the comma-separated `skip` setting into a clean list of basenames. */
export function parseSkip(skip: string): string[] {
	return skip
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/** A likely mistake in a raw `skip` string, surfaced to the user in settings. */
export interface SkipIssue {
	/** The offending entry, trimmed, as the user typed it (empty for the `empty` kind). */
	entry: string;
	/** `whitespace`: internal space/newline (probably a missing comma).
	 *  `separator`: a `/` or `\` (skip matches basenames only, so it can't match).
	 *  `empty`: consecutive commas, which leave an empty entry. */
	kind: "whitespace" | "separator" | "empty";
}

/**
 * Find obvious mistakes in a raw `skip` string. Each entry is a single directory
 * basename, so an entry with internal whitespace (usually a forgotten comma) or a
 * path separator is almost certainly wrong, and consecutive commas (`,,`) leave an
 * empty entry. A single leading/trailing comma and surrounding whitespace are fine —
 * `parseSkip` trims and drops them.
 */
export function validateSkip(skip: string): SkipIssue[] {
	const issues: SkipIssue[] = [];
	for (const part of skip.split(",")) {
		const entry = part.trim();
		if (entry.length === 0) continue;
		if (/\s/.test(entry)) {
			issues.push({ entry, kind: "whitespace" });
		} else if (entry.includes("/") || entry.includes("\\")) {
			issues.push({ entry, kind: "separator" });
		}
	}
	// Consecutive commas (optionally with whitespace between) leave an empty entry.
	if (/,\s*,/.test(skip)) {
		issues.push({ entry: "", kind: "empty" });
	}
	return issues;
}
