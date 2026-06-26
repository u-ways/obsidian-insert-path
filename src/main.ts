import { Plugin } from "obsidian";
import type { Editor } from "obsidian";
import { DEFAULT_SETTINGS, type PathPickerSettings, type WalkMode } from "./types";
import { buildInsertion } from "./core/insert";
import { PathPickerModal } from "./ui/PathPickerModal";
import { PathPickerSettingTab } from "./ui/settings";

export default class PathPickerPlugin extends Plugin {
	settings: PathPickerSettings = { ...DEFAULT_SETTINGS };

	onload(): void {
		this.addCommand({
			id: "directory-path",
			name: "Insert directory path",
			editorCallback: (editor) => this.openPicker(editor, "dir"),
		});

		this.addCommand({
			id: "file-path",
			name: "Insert file path",
			editorCallback: (editor) => this.openPicker(editor, "file"),
		});

		this.addSettingTab(new PathPickerSettingTab(this.app, this));

		// Keep onload synchronous so it stays out of Obsidian's startup await-chain:
		// read the (tiny) saved settings once the workspace is ready rather than fetching
		// data during load. `settings` is seeded with DEFAULT_SETTINGS, so the picker and
		// settings tab are safe to read before this resolves — and neither is reachable
		// until well after layout-ready. https://docs.obsidian.md/plugins/guides/load-time
		this.app.workspace.onLayoutReady(() => void this.loadSettings());
	}

	private openPicker(editor: Editor, mode: WalkMode): void {
		new PathPickerModal(this.app, this, mode, (abs, rel) => {
			const text = buildInsertion(this.settings.insertionTemplate, { abs, rel });
			editor.replaceSelection(text);
			editor.focus();
		}).open();
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<PathPickerSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
