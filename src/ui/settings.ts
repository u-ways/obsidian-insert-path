import { PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";
import type PathPickerPlugin from "../main";
import { validateSkip, type PrimaryAction } from "../types";

export class PathPickerSettingTab extends PluginSettingTab {
	private readonly plugin: PathPickerPlugin;

	constructor(app: App, plugin: PathPickerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Default root")
			.setDesc("Directory the picker starts from. Defaults to your home folder.")
			.addText((text) =>
				text.setValue(this.plugin.settings.defaultRoot).onChange(async (value) => {
					this.plugin.settings.defaultRoot = value.trim();
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Insertion template")
			.setDesc(
				"Inserted at the cursor. Tokens: {path} (absolute), {name} (basename), {rel} (relative to root).",
			)
			.addText((text) =>
				text
					.setPlaceholder("{path}")
					.setValue(this.plugin.settings.insertionTemplate)
					.onChange(async (value) => {
						this.plugin.settings.insertionTemplate =
							value.length > 0 ? value : "{path}";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Primary action")
			.setDesc(
				"What Enter and click do on the selected entry. The modifier (Alt+Enter / Alt+click) always runs the other one.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("insert", "Insert path")
					.addOption("open", "Open entry")
					.setValue(this.plugin.settings.primaryAction)
					.onChange(async (value) => {
						this.plugin.settings.primaryAction = value as PrimaryAction;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Directory tree depth")
			.setDesc(
				"How many levels deep the preview tree shows for directories. The default is 2. Deeper trees can be slower to render.",
			)
			.addText((text) =>
				text.setValue(String(this.plugin.settings.treeDepth)).onChange(async (value) => {
					const n = Number.parseInt(value, 10);
					if (Number.isFinite(n) && n >= 1) {
						this.plugin.settings.treeDepth = n;
						await this.plugin.saveSettings();
					}
				}),
			);

		new Setting(containerEl)
			.setName("Colorize directory tree")
			.setDesc(
				"Rainbow-colour the directory-preview tree by nesting depth, using your theme's palette. Turn off for a plain, single-colour tree.",
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.colorizeTree).onChange(async (value) => {
					this.plugin.settings.colorizeTree = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Follow symlinks")
			.setDesc("Descend into symlinked directories (cycles are handled safely).")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.followSymlinks).onChange(async (value) => {
					this.plugin.settings.followSymlinks = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Include hidden")
			.setDesc("Include dot-files and dot-directories.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.includeHidden).onChange(async (value) => {
					this.plugin.settings.includeHidden = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Max results")
			.setDesc("Stop walking after this many entries; a notice appears when truncated.")
			.addText((text) =>
				text.setValue(String(this.plugin.settings.maxResults)).onChange(async (value) => {
					const n = Number.parseInt(value, 10);
					if (Number.isFinite(n) && n > 0) {
						this.plugin.settings.maxResults = n;
						await this.plugin.saveSettings();
					}
				}),
			);

		new Setting(containerEl)
			.setName("Max file size for syntax highlighting (kilobytes)")
			.setDesc(
				"Larger files preview as plain text without highlighting. Set to zero to always highlight. The preview reads at most the first 64 kilobytes or 200 lines regardless.",
			)
			.addText((text) =>
				text
					.setValue(String(Math.round(this.plugin.settings.maxHighlightBytes / 1024)))
					.onChange(async (value) => {
						const kb = Number.parseInt(value, 10);
						if (Number.isFinite(kb) && kb >= 0) {
							this.plugin.settings.maxHighlightBytes = kb * 1024;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Max line length for syntax highlighting")
			.setDesc(
				"Skip highlighting when the preview contains a line longer than this many characters, such as in minified files. This keeps highlighting fast. Set to zero to disable the guard.",
			)
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.maxHighlightLineLength))
					.onChange(async (value) => {
						const n = Number.parseInt(value, 10);
						if (Number.isFinite(n) && n >= 0) {
							this.plugin.settings.maxHighlightLineLength = n;
							await this.plugin.saveSettings();
						}
					}),
			);

		// Last, because it gets a full-width resizable box: the skip list can be long.
		new Setting(containerEl)
			.setName("Skip directories")
			.setDesc(
				"Comma-separated directory names pruned while walking. Drag the box's bottom edge to resize it.",
			)
			.setClass("pp-skip-setting")
			.addTextArea((text) => {
				text.inputEl.rows = 6;
				const warningEl = text.inputEl.parentElement?.createDiv({ cls: "pp-skip-warning" });
				const refresh = (value: string): void => {
					if (warningEl) this.renderSkipIssues(warningEl, value);
				};
				text.setValue(this.plugin.settings.skip).onChange(async (value) => {
					this.plugin.settings.skip = value;
					await this.plugin.saveSettings();
					refresh(value);
				});
				refresh(this.plugin.settings.skip);
			});
	}

	/** Render inline warnings under the Skip directories box for likely mistakes. */
	private renderSkipIssues(el: HTMLElement, raw: string): void {
		el.empty();
		for (const issue of validateSkip(raw)) {
			const message =
				issue.kind === "empty"
					? "Consecutive commas leave an empty entry — remove the extra comma(s)."
					: issue.kind === "whitespace"
						? `"${issue.entry}" has a space — did you forget a comma? It is treated as one directory name.`
						: `"${issue.entry}" has a path separator — only directory names are matched, so it won't match anything.`;
			el.createDiv({ cls: "pp-skip-warning-line", text: message });
		}
	}
}
