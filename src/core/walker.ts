import { promises as fsp, type Dirent } from "fs";
import * as path from "path";
import type { WalkEntry, WalkOptions, WalkResult } from "../types";

/** Hard depth backstop so a pathological tree can never hang the walk. */
const MAX_DEPTH = 50;

interface QueuedDir {
	/** Display path (keeps symlink names, relative to the user's root). */
	abs: string;
	/** Resolved real path, used for symlink-cycle detection. */
	real: string;
	depth: number;
}

function makeEntry(root: string, abs: string): WalkEntry {
	const rel = path.relative(root, abs).split(path.sep).join("/");
	return { abs, rel };
}

/**
 * Stream entries under `opts.root` breadth-first.
 *
 * - `mode` selects directories or files.
 * - Hidden entries are included unless `includeHidden` is false.
 * - Directory basenames in `skip` are pruned (their subtrees are never walked).
 * - Symlinked directories are followed only when `followSymlinks` is true; cycles
 *   are detected by comparing a symlink's resolved target against the current
 *   branch's real path (and `realpath`/`stat` throwing ELOOP), with a depth cap
 *   as a final backstop.
 * - Stops after `cap` entries, reporting `{ truncated: true }`.
 * - Aborts promptly when `signal` fires.
 *
 * Throws if `root` does not exist (surfaced to the caller on the first pull).
 */
export async function* walk(opts: WalkOptions): AsyncGenerator<WalkEntry, WalkResult, void> {
	const { root, mode, followSymlinks, includeHidden, signal, cap } = opts;
	const skip = new Set(opts.skip);

	// Resolve the real root up front (throws ENOENT for a missing root).
	const realRoot = await fsp.realpath(root);

	let emitted = 0;
	const queue: QueuedDir[] = [{ abs: root, real: realRoot, depth: 0 }];

	while (queue.length > 0) {
		if (signal.aborted) return { truncated: false };
		const current = queue.shift();
		if (current === undefined) break;

		let dir;
		try {
			dir = await fsp.opendir(current.abs);
		} catch {
			continue; // unreadable directory — skip it
		}

		try {
			let dirent: Dirent | null;
			while ((dirent = await dir.read()) !== null) {
				if (signal.aborted) return { truncated: false };

				const name = dirent.name;
				if (!includeHidden && name.startsWith(".")) continue;

				const childAbs = path.join(current.abs, name);
				let isDir = false;
				let isFile = false;
				let childReal = path.join(current.real, name);

				if (dirent.isSymbolicLink()) {
					if (!followSymlinks) {
						// Treat the link itself as a leaf file; never descend it.
						isFile = true;
					} else {
						try {
							childReal = await fsp.realpath(childAbs);
							const st = await fsp.stat(childReal);
							isDir = st.isDirectory();
							isFile = st.isFile();
						} catch {
							continue; // dangling link or symlink cycle (ELOOP)
						}
					}
				} else {
					isDir = dirent.isDirectory();
					isFile = dirent.isFile();
				}

				if (isDir) {
					if (skip.has(name)) continue;
					if (mode === "dir") {
						yield makeEntry(root, childAbs);
						if (++emitted >= cap) return { truncated: true };
					}
					// Skip descending a symlink that resolves to the current dir or an ancestor.
					if (dirent.isSymbolicLink()) {
						if (
							current.real === childReal ||
							current.real.startsWith(childReal + path.sep)
						) {
							continue;
						}
					}
					if (current.depth + 1 <= MAX_DEPTH) {
						queue.push({ abs: childAbs, real: childReal, depth: current.depth + 1 });
					}
				} else if (isFile && mode === "file") {
					yield makeEntry(root, childAbs);
					if (++emitted >= cap) return { truncated: true };
				}
			}
		} finally {
			await dir.close().catch(() => undefined);
		}
	}

	return { truncated: false };
}
