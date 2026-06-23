import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fsp } from "fs";
import * as os from "os";
import * as path from "path";
import { walk } from "../../src/core/walker";
import type { WalkEntry, WalkMode, WalkResult } from "../../src/types";

let root: string;

const DEFAULT_SKIP = [".git", "node_modules", ".cache"];

async function mk(rel: string, content = "") {
	const full = path.join(root, rel);
	await fsp.mkdir(path.dirname(full), { recursive: true });
	await fsp.writeFile(full, content);
}

interface Opts {
	mode?: WalkMode;
	followSymlinks?: boolean;
	includeHidden?: boolean;
	cap?: number;
	signal?: AbortSignal;
}

function gen(start: string, o: Opts = {}) {
	return walk({
		root: start,
		mode: o.mode ?? "file",
		followSymlinks: o.followSymlinks ?? true,
		includeHidden: o.includeHidden ?? true,
		skip: DEFAULT_SKIP,
		cap: o.cap ?? 100000,
		signal: o.signal ?? new AbortController().signal,
	});
}

async function collect(start: string, o: Opts = {}) {
	const g = gen(start, o);
	const items: WalkEntry[] = [];
	let r = await g.next();
	while (!r.done) {
		items.push(r.value);
		r = await g.next();
	}
	const result = r.value as WalkResult;
	return { items, rels: items.map((e) => e.rel), result };
}

beforeEach(async () => {
	root = await fsp.mkdtemp(path.join(os.tmpdir(), "ip-walk-"));
	await mk("a/a1.txt");
	await mk("a/a2.txt");
	await mk("a/.hiddenfile");
	await mk("a/nested/deep.txt");
	await mk(".hiddendir/secret.txt");
	await mk("node_modules/junk.txt");
	await mk(".git/HEAD");
	await mk("b.txt");
	await fsp.symlink("a", path.join(root, "link_to_a"));
	// A symlink cycle: loop -> loop_target -> loop
	await fsp.symlink("loop_target", path.join(root, "loop"));
	await fsp.symlink("loop", path.join(root, "loop_target"));
});

afterEach(async () => {
	await fsp.rm(root, { recursive: true, force: true });
});

describe("walk", () => {
	it("dir mode emits directories only (relative, POSIX paths), following symlinks", async () => {
		const { rels } = await collect(root, { mode: "dir" });
		expect([...rels].sort()).toEqual(
			[".hiddendir", "a", "a/nested", "link_to_a", "link_to_a/nested"].sort(),
		);
		expect(rels.some((r) => r.endsWith(".txt"))).toBe(false);
	});

	it("file mode emits files only", async () => {
		const { rels } = await collect(root, { mode: "file" });
		expect([...rels].sort()).toEqual(
			[
				".hiddendir/secret.txt",
				"a/.hiddenfile",
				"a/a1.txt",
				"a/a2.txt",
				"a/nested/deep.txt",
				"b.txt",
				"link_to_a/.hiddenfile",
				"link_to_a/a1.txt",
				"link_to_a/a2.txt",
				"link_to_a/nested/deep.txt",
			].sort(),
		);
	});

	it("excludes hidden entries when includeHidden is false", async () => {
		const { rels } = await collect(root, { mode: "file", includeHidden: false });
		expect(rels.some((r) => r.split("/").some((seg) => seg.startsWith(".")))).toBe(false);
		expect(rels).toContain("b.txt");
		expect(rels).toContain("a/a1.txt");
	});

	it("prunes skip directories (.git, node_modules) in both modes", async () => {
		const files = await collect(root, { mode: "file" });
		const dirs = await collect(root, { mode: "dir" });
		for (const r of [...files.rels, ...dirs.rels]) {
			expect(r.split("/")).not.toContain("node_modules");
			expect(r.split("/")).not.toContain(".git");
		}
	});

	it("does not descend symlinked directories when followSymlinks is false", async () => {
		const { rels } = await collect(root, { mode: "file", followSymlinks: false });
		expect(rels.some((r) => r.startsWith("link_to_a/"))).toBe(false);
		expect(rels).toContain("a/a1.txt");
	});

	it("terminates on a symlink cycle and never emits the looping links", async () => {
		const { rels, result } = await collect(root, { mode: "file" });
		expect(rels.some((r) => r.includes("loop"))).toBe(false);
		expect(result.truncated).toBe(false);
	});

	it("emits a parent directory before its child (breadth-first)", async () => {
		const { rels } = await collect(root, { mode: "dir" });
		expect(rels.indexOf("a")).toBeLessThan(rels.indexOf("a/nested"));
	});

	it("stops at the cap and reports truncation", async () => {
		const capped = await collect(root, { mode: "file", cap: 3 });
		expect(capped.items).toHaveLength(3);
		expect(capped.result.truncated).toBe(true);

		const full = await collect(root, { mode: "file", cap: 100000 });
		expect(full.result.truncated).toBe(false);
	});

	it("aborts promptly, emitting far fewer entries", async () => {
		const ac = new AbortController();
		const g = gen(root, { mode: "file", signal: ac.signal });
		const items: WalkEntry[] = [];
		const first = await g.next();
		if (!first.done) items.push(first.value);
		ac.abort();
		let r = await g.next();
		while (!r.done) {
			items.push(r.value);
			r = await g.next();
		}
		const full = await collect(root, { mode: "file" });
		expect(items.length).toBeLessThan(full.items.length);
	});

	it("throws for a non-existent root", async () => {
		await expect(collect(path.join(root, "does-not-exist"))).rejects.toThrow();
	});
});
