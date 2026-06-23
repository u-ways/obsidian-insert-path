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
};

/** Parse the comma-separated `skip` setting into a clean list of basenames. */
export function parseSkip(skip: string): string[] {
	return skip
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}
