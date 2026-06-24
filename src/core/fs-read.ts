// The plugin's single point of filesystem access.
//
// It deliberately exposes ONLY read operations: no write/create/delete/rename API from
// `node:fs` is re-exported, and the file-reading helper never returns a writable
// FileHandle — so there is no code path through which the shipped plugin can modify the
// filesystem. An ESLint rule (`no-restricted-imports`, see eslint.config.mjs) forbids
// importing `fs`/`node:fs` anywhere else under `src/`, making this module the only place
// the plugin touches the disk. See docs/SECURITY.md.

import { promises as fsp, type Dir, type Dirent, type Stats } from "fs";

export type { Dir, Dirent, Stats };

/** Resolve a path to its canonical location (throws ENOENT if it does not exist). */
export function realpath(p: string): Promise<string> {
	return fsp.realpath(p);
}

/** Stat a path, following symlinks. */
export function stat(p: string): Promise<Stats> {
	return fsp.stat(p);
}

/** Open a directory as a read-only stream (the Dir handle cannot write). */
export function opendir(p: string): Promise<Dir> {
	return fsp.opendir(p);
}

/** List a directory's entries with their file types. */
export function readdir(p: string): Promise<Dirent[]> {
	return fsp.readdir(p, { withFileTypes: true });
}

/** The head of a file: the first bytes read, plus the file's total size. */
export interface FileHead {
	/** The first up-to-`maxBytes` bytes of the file. */
	bytes: Buffer;
	/** The file's total size in bytes (from fstat on the open handle). */
	size: number;
}

/**
 * Read up to `maxBytes` from the start of a file, and report its total size. The
 * file is opened read-only, stat'd and read once on the same handle (so the size
 * costs no extra syscall), and closed here — the writable FileHandle never escapes
 * this function.
 */
export async function readHead(file: string, maxBytes: number): Promise<FileHead> {
	const handle = await fsp.open(file, "r");
	try {
		const { size } = await handle.stat();
		const buf = Buffer.alloc(maxBytes);
		const { bytesRead } = await handle.read(buf, 0, maxBytes, 0);
		return { bytes: buf.subarray(0, bytesRead), size };
	} finally {
		await handle.close();
	}
}
