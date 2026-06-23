import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";

export interface RootChoiceContext {
	currentRoot: string;
	homeDir: string;
	/** Absolute path of the vault, when available. */
	vaultRoot: string | null;
	/** Recently used roots, most-recent first. */
	recents: string[];
}

/**
 * Small nested modal for changing the search root: Home, the vault root, recent
 * roots, or a typed/pasted custom path. Resolves via `onChoose`.
 */
export class RootSwitcher extends Modal {
	private readonly ctx: RootChoiceContext;
	private readonly onChoose: (root: string) => void;

	constructor(app: App, ctx: RootChoiceContext, onChoose: (root: string) => void) {
		super(app);
		this.ctx = ctx;
		this.onChoose = onChoose;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ip-root-switcher");
		this.titleEl.setText("Change search root");

		const choose = (root: string): void => {
			this.close();
			this.onChoose(root);
		};

		const list = contentEl.createDiv({ cls: "ip-root-list" });
		const addChoice = (label: string, value: string): void => {
			const item = list.createEl("button", { cls: "ip-root-choice", text: label });
			item.addEventListener("click", () => choose(value));
		};

		addChoice(`Home — ${this.ctx.homeDir}`, this.ctx.homeDir);
		if (this.ctx.vaultRoot) {
			addChoice(`Vault root — ${this.ctx.vaultRoot}`, this.ctx.vaultRoot);
		}
		for (const recent of this.ctx.recents) {
			addChoice(recent, recent);
		}

		new Setting(contentEl).setName("Custom path").addText((text) => {
			text.setValue(this.ctx.currentRoot).setPlaceholder("/absolute/path");
			text.inputEl.addEventListener("keydown", (evt: KeyboardEvent) => {
				if (evt.key === "Enter") {
					evt.preventDefault();
					const value = text.getValue().trim();
					if (value.length > 0) choose(value);
				}
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
