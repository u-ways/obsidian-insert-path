import { readHead, readdir, type Dirent } from "./fs-read";
import * as path from "path";

export interface DirPreviewOptions {
	/** Directory basenames to prune from the tree. */
	skip?: string[];
	/** Max children listed per directory level before collapsing to "… (N more)". */
	maxEntries?: number;
	/** How many levels deep to descend (default 2). */
	maxDepth?: number;
}

export interface FilePreviewOptions {
	/** Max lines to show. */
	maxLines?: number;
	/** Max bytes to read (bounds work on huge files). */
	maxBytes?: number;
}

export interface FilePreview {
	text: string;
	/** True if the file was cut off (by line or byte limit). */
	truncated: boolean;
	/** True if the head looked binary (contained a NUL byte). */
	binary: boolean;
	/** True if the file could not be read (text is a placeholder). */
	error: boolean;
	/** The file's total size in bytes (0 when unreadable). */
	size: number;
}

const DEFAULT_MAX_ENTRIES = 50;
const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_MAX_LINES = 200;
const DEFAULT_MAX_BYTES = 64 * 1024;

/** Directories first, then files; each group sorted by name (locale-independent). */
function compareDirents(a: Dirent, b: Dirent): number {
	const ad = a.isDirectory() ? 0 : 1;
	const bd = b.isDirectory() ? 0 : 1;
	if (ad !== bd) return ad - bd;
	return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

async function appendChildren(
	dir: string,
	prefix: string,
	depth: number,
	maxDepth: number,
	skip: Set<string>,
	maxEntries: number,
	lines: string[],
): Promise<void> {
	const dirents = (await readdir(dir)).filter((d) => !skip.has(d.name)).sort(compareDirents);

	const shown = dirents.slice(0, maxEntries);
	const overflow = dirents.length - shown.length;

	for (const [i, d] of shown.entries()) {
		const isLast = i === shown.length - 1 && overflow === 0;
		const isDir = d.isDirectory();
		const connector = isLast ? "└── " : "├── ";
		lines.push(prefix + connector + d.name + (isDir ? "/" : ""));
		if (isDir && depth < maxDepth) {
			const childPrefix = prefix + (isLast ? "    " : "│   ");
			try {
				await appendChildren(
					path.join(dir, d.name),
					childPrefix,
					depth + 1,
					maxDepth,
					skip,
					maxEntries,
					lines,
				);
			} catch {
				lines.push(childPrefix + "└── [unreadable]");
			}
		}
	}

	if (overflow > 0) {
		lines.push(prefix + `└── … (${overflow} more)`);
	}
}

/**
 * Render an indented tree of `dir` up to `maxDepth` levels (default 2, like
 * `eza --tree --level=N`). Prunes `skip` directories; returns a placeholder if
 * the directory can't be read.
 */
export async function previewDir(dir: string, opts: DirPreviewOptions = {}): Promise<string> {
	const skip = new Set(opts.skip ?? []);
	const maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
	const maxDepth = Math.max(1, Math.floor(opts.maxDepth ?? DEFAULT_MAX_DEPTH));
	const lines: string[] = [path.basename(dir) + "/"];
	try {
		await appendChildren(dir, "", 1, maxDepth, skip, maxEntries, lines);
	} catch {
		return "[cannot read directory]";
	}
	return lines.join("\n");
}

/**
 * Read the head of `file` for preview (like `bat --line-range=:200`).
 * Reads at most `maxBytes`, detects binary content (NUL byte), caps at `maxLines`,
 * and returns a placeholder instead of throwing when the file can't be read.
 *
 * The byte/line caps below are load-bearing for more than memory: the preview is
 * syntax-highlighted synchronously on the main thread, so bounding the head also
 * bounds worst-case tokenization cost (including any Prism ReDoS tail-risk). Do
 * not raise them without re-evaluating that.
 */
export async function previewFile(
	file: string,
	opts: FilePreviewOptions = {},
): Promise<FilePreview> {
	const maxLines = opts.maxLines ?? DEFAULT_MAX_LINES;
	const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

	let head: { bytes: Buffer; size: number };
	try {
		head = await readHead(file, maxBytes);
	} catch {
		return {
			text: "[cannot read file]",
			truncated: false,
			binary: false,
			error: true,
			size: 0,
		};
	}

	const slice = head.bytes;
	const size = head.size;

	if (slice.includes(0)) {
		return { text: "[binary file]", truncated: false, binary: true, error: false, size };
	}

	let truncated = slice.length >= maxBytes;
	let lines = slice.toString("utf8").split("\n");
	if (lines.length > maxLines) {
		lines = lines.slice(0, maxLines);
		truncated = true;
	}
	return { text: lines.join("\n"), truncated, binary: false, error: false, size };
}
