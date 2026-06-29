import { FileSystemAdapter } from "obsidian";
import type { App } from "obsidian";

/** The vault's absolute base path, or null when it isn't a local-filesystem vault. */
export function vaultBasePath(app: App): string | null {
	const adapter = app.vault.adapter;
	return adapter instanceof FileSystemAdapter ? adapter.getBasePath() : null;
}
