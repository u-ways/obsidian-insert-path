import { Plugin } from "obsidian";
import type { Editor } from "obsidian";
import { DEFAULT_SETTINGS, type InsertPathSettings, type WalkMode } from "./types";
import { buildInsertion } from "./core/insert";
import { InsertPathModal } from "./ui/InsertPathModal";
import { InsertPathSettingTab } from "./ui/settings";

export default class InsertPathPlugin extends Plugin {
	settings: InsertPathSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: "insert-directory-path",
			name: "Insert directory path",
			editorCallback: (editor) => this.openPicker(editor, "dir"),
		});

		this.addCommand({
			id: "insert-file-path",
			name: "Insert file path",
			editorCallback: (editor) => this.openPicker(editor, "file"),
		});

		this.addSettingTab(new InsertPathSettingTab(this.app, this));
	}

	private openPicker(editor: Editor, mode: WalkMode): void {
		new InsertPathModal(this.app, this, mode, (abs, rel) => {
			const text = buildInsertion(this.settings.insertionTemplate, { abs, rel });
			editor.replaceSelection(text);
			editor.focus();
		}).open();
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<InsertPathSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
