import * as os from "os";

export type WalkMode = "dir" | "file";

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

export interface InsertPathSettings {
	/** Root the picker starts from (default: the user's home directory). */
	defaultRoot: string;
	/** Template for the inserted text. Tokens: {path}, {name}, {rel}. */
	insertionTemplate: string;
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

export const DEFAULT_SETTINGS: InsertPathSettings = {
	defaultRoot: os.homedir(),
	insertionTemplate: "{path}",
	recentRoots: [],
	skip: ".git, node_modules, .cache",
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

/** Parse the comma-separated `skip` setting into a clean list of basenames. */
export function parseSkip(skip: string): string[] {
	return skip
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}
