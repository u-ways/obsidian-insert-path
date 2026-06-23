import { PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";
import type InsertPathPlugin from "../main";

export class InsertPathSettingTab extends PluginSettingTab {
	private readonly plugin: InsertPathPlugin;

	constructor(app: App, plugin: InsertPathPlugin) {
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
			.setName("Skip directories")
			.setDesc("Comma-separated directory names to prune while walking.")
			.addText((text) =>
				text.setValue(this.plugin.settings.skip).onChange(async (value) => {
					this.plugin.settings.skip = value;
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
	}
}
