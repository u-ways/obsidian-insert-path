// Minimal runtime stub of the `obsidian` module for vitest.
// The plugin's pure logic lives under src/core (no obsidian import); this stub
// only needs to provide the runtime base classes so the thin UI layer can be
// imported under the vitest alias without pulling in the real Obsidian runtime.

export class Scope {
	register(): unknown {
		return {};
	}
}

export class Plugin {}

export class Modal {
	app: unknown;
	constructor(app: unknown) {
		this.app = app;
	}
	open(): void {}
	close(): void {}
}

export class PluginSettingTab {
	app: unknown;
	plugin: unknown;
	constructor(app: unknown, plugin: unknown) {
		this.app = app;
		this.plugin = plugin;
	}
}

export class Setting {
	constructor(_containerEl: unknown) {}
}

export class Notice {
	constructor(_message: unknown) {}
}

export class FileSystemAdapter {
	getBasePath(): string {
		return "";
	}
}

export function normalizePath(p: string): string {
	return p;
}
