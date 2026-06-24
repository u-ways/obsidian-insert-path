import { FileSystemAdapter, Modal, Notice } from "obsidian";
import type { App } from "obsidian";
import { stat } from "../core/fs-read";
import * as os from "os";
import { walk } from "../core/walker";
import { Matcher, type MatchResult } from "../core/matcher";
import { previewDir, previewFile } from "../core/preview";
import { getPrism, prismLangFor, shouldHighlight } from "../core/prism";
import { addRecentRoot } from "../core/recent";
import { clampSplitRatio, parseSkip, SPLIT_DEFAULT, type WalkMode } from "../types";
import type InsertPathPlugin from "../main";
import { RootSwitcher } from "./RootSwitcher";

const SEARCH_DEBOUNCE_MS = 60;
const PREVIEW_DEBOUNCE_MS = 60;
const STREAM_THROTTLE_MS = 100;
const RESULT_LIMIT = 200;

/**
 * The fzf-style picker: search box, results list with live match highlighting,
 * a side preview pane, a root bar, and a footer. Streams a directory walk into
 * the matcher and inserts the chosen absolute path via `onChoose`.
 */
export class InsertPathModal extends Modal {
	private readonly plugin: InsertPathPlugin;
	private readonly onChoose: (abs: string, rel: string) => void;

	private mode: WalkMode;
	private root: string;
	private query = "";

	private candidates: string[] = [];
	private candidatesDirty = true;
	private readonly entryMap = new Map<string, string>();
	private results: MatchResult[] = [];
	private selectedIndex = 0;

	private readonly matcher = new Matcher({ limit: RESULT_LIMIT });
	private walkController: AbortController | null = null;
	private truncatedNotified = false;

	private searchTimer?: number;
	private previewTimer?: number;
	private streamTimer?: number;
	private previewToken = 0;

	private rootBarEl!: HTMLElement;
	private modeEl!: HTMLElement;
	private rootPathEl!: HTMLElement;
	private searchEl!: HTMLInputElement;
	private bodyEl!: HTMLElement;
	private resultsEl!: HTMLElement;
	private dividerEl!: HTMLElement;
	private previewEl!: HTMLElement;
	private rowEls: HTMLElement[] = [];
	private dragCleanup: (() => void) | null = null;

	constructor(
		app: App,
		plugin: InsertPathPlugin,
		mode: WalkMode,
		onChoose: (abs: string, rel: string) => void,
	) {
		super(app);
		this.plugin = plugin;
		this.onChoose = onChoose;
		this.mode = mode;
		this.root = plugin.settings.defaultRoot || os.homedir();
	}

	onOpen(): void {
		this.modalEl.addClass("ip-modal");
		this.buildDom();
		this.registerKeys();
		this.searchEl.focus();
		// Warm Obsidian's Prism now so the first file preview isn't briefly unhighlighted.
		void getPrism();
		void this.startWalk();
	}

	onClose(): void {
		this.walkController?.abort();
		this.endDrag(); // drop any in-progress divider drag listeners
		window.clearTimeout(this.searchTimer);
		window.clearTimeout(this.previewTimer);
		window.clearTimeout(this.streamTimer);
		this.contentEl.empty();
		this.modalEl.removeClass("ip-modal");
	}

	private buildDom(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.rootBarEl = contentEl.createDiv({ cls: "ip-root-bar" });
		this.modeEl = this.rootBarEl.createSpan({ cls: "ip-mode" });
		this.rootPathEl = this.rootBarEl.createSpan({ cls: "ip-root-path" });

		this.searchEl = contentEl.createEl("input", {
			cls: "ip-search",
			type: "text",
		});
		this.searchEl.addEventListener("input", () => this.onQueryChange());

		this.bodyEl = contentEl.createDiv({ cls: "ip-body" });
		this.resultsEl = this.bodyEl.createDiv({ cls: "ip-results" });
		this.dividerEl = this.bodyEl.createDiv({ cls: "ip-divider" });
		this.dividerEl.setAttribute("aria-label", "Drag to resize · double-click to reset");
		this.previewEl = this.bodyEl.createDiv({ cls: "ip-preview" });

		this.applySplit(this.plugin.settings.splitRatio);
		this.dividerEl.addEventListener("pointerdown", (e) => this.startDrag(e));
		this.dividerEl.addEventListener("dblclick", () => void this.setSplit(SPLIT_DEFAULT));

		contentEl.createDiv({
			cls: "ip-footer",
			text: "↑↓ move · Enter insert · Tab dir/file · Ctrl+O root · Esc close",
		});

		this.updateRootBar();
	}

	/** Apply a results-pane width fraction to the layout (preview takes the rest). */
	private applySplit(ratio: number): void {
		const pct = (clampSplitRatio(ratio) * 100).toFixed(2);
		this.resultsEl.style.flex = `0 0 ${pct}%`;
	}

	/** Apply a split and persist it so it survives the next time the picker opens. */
	private async setSplit(ratio: number): Promise<void> {
		const clamped = clampSplitRatio(ratio);
		this.applySplit(clamped);
		this.plugin.settings.splitRatio = clamped;
		await this.plugin.saveSettings();
	}

	/** Drag the divider: live-resize while held, then persist the ratio on release. */
	private startDrag(e: PointerEvent): void {
		e.preventDefault();
		this.modalEl.addClass("ip-dragging");
		let ratio = this.plugin.settings.splitRatio;

		const onMove = (ev: PointerEvent) => {
			const rect = this.bodyEl.getBoundingClientRect();
			if (rect.width === 0) return;
			ratio = clampSplitRatio((ev.clientX - rect.left) / rect.width);
			this.applySplit(ratio);
		};
		const onUp = () => {
			this.endDrag();
			void this.setSplit(ratio);
		};

		this.dragCleanup = () => {
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onUp);
			this.modalEl.removeClass("ip-dragging");
		};
		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onUp);
	}

	private endDrag(): void {
		this.dragCleanup?.();
		this.dragCleanup = null;
	}

	private registerKeys(): void {
		this.scope.register([], "ArrowDown", () => this.move(1));
		this.scope.register([], "ArrowUp", () => this.move(-1));
		this.scope.register(["Ctrl"], "n", () => this.move(1));
		this.scope.register(["Ctrl"], "p", () => this.move(-1));
		this.scope.register([], "Enter", () => this.choose());
		this.scope.register([], "Tab", () => this.toggleMode());
		this.scope.register(["Mod"], "o", () => this.openRootSwitcher());
	}

	private updateRootBar(): void {
		this.modeEl.setText(this.mode === "dir" ? "DIR" : "FILE");
		this.modeEl.toggleClass("is-file", this.mode === "file");
		this.rootPathEl.setText(this.root);
		this.searchEl.setAttribute(
			"placeholder",
			this.mode === "dir" ? "Search directories…" : "Search files…",
		);
	}

	private onQueryChange(): void {
		this.query = this.searchEl.value;
		this.selectedIndex = 0;
		window.clearTimeout(this.searchTimer);
		this.searchTimer = window.setTimeout(() => void this.refreshResults(), SEARCH_DEBOUNCE_MS);
	}

	private scheduleStreamRefresh(): void {
		if (this.streamTimer !== undefined) return;
		this.streamTimer = window.setTimeout(() => {
			this.streamTimer = undefined;
			void this.refreshResults();
		}, STREAM_THROTTLE_MS);
	}

	private async startWalk(): Promise<void> {
		this.walkController?.abort();
		const controller = new AbortController();
		this.walkController = controller;

		this.candidates = [];
		this.entryMap.clear();
		this.candidatesDirty = true;
		this.results = [];
		this.selectedIndex = 0;
		this.truncatedNotified = false;
		this.renderResults();
		this.previewEl.empty();

		const settings = this.plugin.settings;
		const generator = walk({
			root: this.root,
			mode: this.mode,
			followSymlinks: settings.followSymlinks,
			includeHidden: settings.includeHidden,
			skip: parseSkip(settings.skip),
			cap: settings.maxResults,
			signal: controller.signal,
		});

		try {
			let next = await generator.next();
			while (!next.done) {
				if (controller.signal.aborted) return;
				this.candidates.push(next.value.rel);
				this.entryMap.set(next.value.rel, next.value.abs);
				this.candidatesDirty = true;
				this.scheduleStreamRefresh();
				next = await generator.next();
			}
			if (controller.signal.aborted) return;
			if (next.value.truncated && !this.truncatedNotified) {
				this.truncatedNotified = true;
				new Notice(
					`Insert Path: results capped at ${settings.maxResults}. Narrow your search or raise the cap in settings.`,
				);
			}
			await this.refreshResults();
		} catch {
			if (!controller.signal.aborted) {
				new Notice(`Insert Path: cannot read ${this.root}`);
			}
		}
	}

	private async refreshResults(): Promise<void> {
		if (this.candidatesDirty) {
			this.matcher.setCandidates(this.candidates);
			this.candidatesDirty = false;
		}
		const res = await this.matcher.run(this.query);
		if (res === null) return; // superseded
		this.results = res;
		if (this.selectedIndex >= this.results.length) {
			this.selectedIndex = Math.max(0, this.results.length - 1);
		}
		this.renderResults();
		this.schedulePreview();
	}

	private renderResults(): void {
		this.resultsEl.empty();
		this.rowEls = [];

		if (this.results.length === 0) {
			this.resultsEl.createDiv({
				cls: "ip-empty",
				text: this.candidates.length > 0 ? "No matches" : "Walking…",
			});
			return;
		}

		this.results.forEach((match, index) => {
			const row = this.resultsEl.createDiv({ cls: "ip-row" });
			if (index === this.selectedIndex) row.addClass("is-selected");
			this.renderHighlighted(row, match.rel, match.positions);
			row.addEventListener("click", () => {
				this.selectedIndex = index;
				this.choose();
			});
			this.rowEls.push(row);
		});
	}

	private renderHighlighted(container: HTMLElement, text: string, positions: Set<number>): void {
		let i = 0;
		while (i < text.length) {
			const matched = positions.has(i);
			let j = i;
			while (j < text.length && positions.has(j) === matched) j++;
			const segment = text.slice(i, j);
			container.createSpan({ cls: matched ? "ip-match" : "", text: segment });
			i = j;
		}
	}

	private move(delta: number): false {
		if (this.results.length > 0) {
			this.selectedIndex = Math.max(
				0,
				Math.min(this.results.length - 1, this.selectedIndex + delta),
			);
			this.updateSelection();
		}
		return false;
	}

	private updateSelection(): void {
		this.rowEls.forEach((el, i) => el.toggleClass("is-selected", i === this.selectedIndex));
		this.rowEls[this.selectedIndex]?.scrollIntoView({ block: "nearest" });
		this.schedulePreview();
	}

	private schedulePreview(): void {
		window.clearTimeout(this.previewTimer);
		this.previewTimer = window.setTimeout(() => void this.loadPreview(), PREVIEW_DEBOUNCE_MS);
	}

	private async loadPreview(): Promise<void> {
		const match = this.results[this.selectedIndex];
		if (!match) {
			this.previewEl.empty();
			return;
		}
		const abs = this.entryMap.get(match.rel);
		if (abs === undefined) return;

		const token = ++this.previewToken;

		if (this.mode === "dir") {
			const text = await previewDir(abs, { skip: parseSkip(this.plugin.settings.skip) });
			if (token !== this.previewToken) return; // a newer selection won
			this.previewEl.empty();
			this.previewEl.createEl("pre", { cls: "ip-tree", text }); // the ascii tree stays plain
			return;
		}

		const file = await previewFile(abs);
		if (token !== this.previewToken) return; // a newer selection won

		this.previewEl.empty();
		const pre = this.previewEl.createEl("pre");
		const code = pre.createEl("code");
		code.setText(file.text); // textContent only — file content is never parsed as markup
		// The truncation marker is its own node so Prism never tokenizes/recolors it.
		if (file.truncated) pre.createEl("span", { cls: "ip-truncated", text: "\n…" });

		// shouldHighlight() rejects binary/unreadable previews BEFORE we derive a
		// language or touch Prism — the boundary that keeps binary content out of the
		// tokenizer — and also enforces the user's size / long-line guards.
		const limits = {
			maxHighlightBytes: this.plugin.settings.maxHighlightBytes,
			maxHighlightLineLength: this.plugin.settings.maxHighlightLineLength,
		};
		if (!shouldHighlight(file, limits)) return;
		const lang = prismLangFor(abs); // from the filename only, never file content
		if (!lang) return;

		const prism = await getPrism();
		if (token !== this.previewToken) return; // a newer selection may have won during the await
		if (prism?.languages?.[lang]) {
			code.addClass(`language-${lang}`);
			try {
				prism.highlightElement(code);
			} catch {
				// Leave the plain text already in the DOM — byte-for-byte the old behavior.
			}
		}
	}

	private choose(): false {
		const match = this.results[this.selectedIndex];
		if (match) {
			const abs = this.entryMap.get(match.rel);
			if (abs !== undefined) {
				this.close();
				this.onChoose(abs, match.rel);
			}
		}
		return false;
	}

	private toggleMode(): false {
		this.mode = this.mode === "dir" ? "file" : "dir";
		this.updateRootBar();
		void this.startWalk();
		return false;
	}

	private openRootSwitcher(): false {
		const adapter = this.app.vault.adapter;
		const vaultRoot = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : null;
		new RootSwitcher(
			this.app,
			{
				currentRoot: this.root,
				homeDir: os.homedir(),
				vaultRoot,
				recents: this.plugin.settings.recentRoots,
			},
			(root) => void this.setRoot(root),
		).open();
		return false;
	}

	private async setRoot(root: string): Promise<void> {
		const trimmed = root.trim();
		try {
			const info = await stat(trimmed);
			if (!info.isDirectory()) throw new Error("not a directory");
		} catch {
			new Notice(`Insert Path: not a directory: ${trimmed}`);
			return;
		}
		this.root = trimmed;
		this.plugin.settings.recentRoots = addRecentRoot(this.plugin.settings.recentRoots, trimmed);
		await this.plugin.saveSettings();
		this.updateRootBar();
		this.searchEl.focus();
		void this.startWalk();
	}
}
