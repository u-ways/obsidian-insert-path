import { RECENT_ROOTS_LIMIT } from "../types";

/** Trim whitespace and strip trailing slashes (but keep the filesystem root "/"). */
function normalizeRoot(root: string): string {
	const trimmed = root.trim();
	if (trimmed.length <= 1) return trimmed;
	return trimmed.replace(/\/+$/, "");
}

/**
 * Return a new recents list with `root` promoted to the front.
 *
 * Normalizes/trims the input, de-duplicates against existing entries, ignores
 * empty input, and caps the list length. Never mutates the input array.
 */
export function addRecentRoot(
	recents: string[],
	root: string,
	limit: number = RECENT_ROOTS_LIMIT,
): string[] {
	const normalized = normalizeRoot(root);
	if (normalized.length === 0) {
		return recents.slice(0, limit);
	}
	const deduped = recents.filter((r) => normalizeRoot(r) !== normalized);
	return [normalized, ...deduped].slice(0, limit);
}
