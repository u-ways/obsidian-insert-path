import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fsp } from "fs";
import * as os from "os";
import * as path from "path";
import { buildDirTree, previewDir, previewFile } from "../../src/core/preview";

let tmp: string;

async function write(rel: string, content = "") {
	const full = path.join(tmp, rel);
	await fsp.mkdir(path.dirname(full), { recursive: true });
	await fsp.writeFile(full, content);
	return full;
}

beforeEach(async () => {
	tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "pp-preview-"));
});

afterEach(async () => {
	await fsp.rm(tmp, { recursive: true, force: true });
});

describe("previewDir", () => {
	it("renders a 2-level tree, dirs first then files, skip-pruned", async () => {
		await write("project/alpha/a1.txt");
		await write("project/alpha/a2.txt");
		await write("project/beta/sub/deep.txt");
		await write("project/beta/b1.txt");
		await write("project/zeta.txt");
		await write("project/node_modules/junk.txt");

		const tree = await previewDir(path.join(tmp, "project"), { skip: ["node_modules"] });

		expect(tree).toBe(
			[
				"project/",
				"├── alpha/",
				"│   ├── a1.txt",
				"│   └── a2.txt",
				"├── beta/",
				"│   ├── sub/",
				"│   └── b1.txt",
				"└── zeta.txt",
			].join("\n"),
		);
	});

	it("does not descend past level 2 (sub/ children are hidden) by default", async () => {
		await write("p/beta/sub/deep.txt");
		const tree = await previewDir(path.join(tmp, "p"));
		expect(tree).toContain("sub/");
		expect(tree).not.toContain("deep.txt");
	});

	it("descends deeper when maxDepth is increased", async () => {
		await write("p/beta/sub/deep.txt");
		const tree = await previewDir(path.join(tmp, "p"), { maxDepth: 3 });
		expect(tree).toContain("sub/");
		expect(tree).toContain("deep.txt");
	});

	it("shows only the top level at maxDepth 1", async () => {
		await write("p/alpha/a1.txt");
		await write("p/zeta.txt");
		const tree = await previewDir(path.join(tmp, "p"), { maxDepth: 1 });
		expect(tree).toContain("alpha/");
		expect(tree).toContain("zeta.txt");
		expect(tree).not.toContain("a1.txt");
	});

	it("clamps a maxDepth below 1 to a single level", async () => {
		await write("p/alpha/a1.txt");
		const tree = await previewDir(path.join(tmp, "p"), { maxDepth: 0 });
		expect(tree).toContain("alpha/");
		expect(tree).not.toContain("a1.txt");
	});

	it("collapses entries beyond maxEntries into a '… (N more)' line", async () => {
		for (let i = 0; i < 6; i++) await write(`p/f${i}.txt`);
		const tree = await previewDir(path.join(tmp, "p"), { maxEntries: 3 });
		expect(tree).toContain("… (3 more)");
	});

	it("returns a placeholder for a missing directory", async () => {
		const tree = await previewDir(path.join(tmp, "does-not-exist"));
		expect(tree).toBe("[cannot read directory]");
	});
});

describe("buildDirTree", () => {
	const find = (lines: Awaited<ReturnType<typeof buildDirTree>>, needle: string) =>
		lines.find((l) => l.text.includes(needle));

	it("tags each row with its nesting depth and dir/file kind", async () => {
		await write("project/alpha/a1.txt");
		await write("project/zeta.txt");

		const lines = await buildDirTree(path.join(tmp, "project"));

		expect(find(lines, "project/")).toMatchObject({ depth: 0, isDir: true, muted: false });
		expect(find(lines, "alpha/")).toMatchObject({ depth: 1, isDir: true, muted: false });
		expect(find(lines, "a1.txt")).toMatchObject({ depth: 2, isDir: false, muted: false });
		expect(find(lines, "zeta.txt")).toMatchObject({ depth: 1, isDir: false, muted: false });
	});

	it("joins to exactly the previewDir text", async () => {
		await write("project/alpha/a1.txt");
		await write("project/zeta.txt");

		const dir = path.join(tmp, "project");
		const joined = (await buildDirTree(dir)).map((l) => l.text).join("\n");
		expect(joined).toBe(await previewDir(dir));
	});

	it("marks an overflow row as muted", async () => {
		for (let i = 0; i < 6; i++) await write(`p/f${i}.txt`);
		const lines = await buildDirTree(path.join(tmp, "p"), { maxEntries: 3 });
		expect(find(lines, "more)")).toMatchObject({ muted: true });
	});

	it("returns a single muted placeholder for a missing directory", async () => {
		const lines = await buildDirTree(path.join(tmp, "does-not-exist"));
		expect(lines).toEqual([
			{ depth: 0, text: "[cannot read directory]", isDir: false, muted: true },
		]);
	});
});

describe("previewFile", () => {
	it("returns the head of a small text file", async () => {
		const content = "line1\nline2\nline3";
		const f = await write("a.txt", content);
		const r = await previewFile(f);
		expect(r).toEqual({
			text: content,
			truncated: false,
			binary: false,
			error: false,
			size: Buffer.byteLength(content),
		});
	});

	it("caps at maxLines and flags truncation", async () => {
		const f = await write("big.txt", Array.from({ length: 300 }, (_, i) => `L${i}`).join("\n"));
		const r = await previewFile(f, { maxLines: 200 });
		expect(r.binary).toBe(false);
		expect(r.truncated).toBe(true);
		expect(r.text.split("\n")).toHaveLength(200);
	});

	it("detects binary content (NUL byte) without returning garbage", async () => {
		const f = path.join(tmp, "bin");
		await fsp.writeFile(f, Buffer.from([0x68, 0x69, 0x00, 0x01, 0x02]));
		const r = await previewFile(f);
		expect(r).toEqual({
			text: "[binary file]",
			truncated: false,
			binary: true,
			error: false,
			size: 5,
		});
	});

	it("only reads up to maxBytes on a large file", async () => {
		const f = await write("huge.txt", "x".repeat(1_000_000));
		const r = await previewFile(f, { maxBytes: 100, maxLines: 1000 });
		expect(r.binary).toBe(false);
		expect(r.truncated).toBe(true);
		expect(r.text.length).toBeLessThanOrEqual(100);
		expect(r.size).toBe(1_000_000); // full size from fstat, not just the bytes read
	});

	it("handles an empty file gracefully", async () => {
		const f = await write("empty.txt", "");
		const r = await previewFile(f);
		expect(r).toEqual({ text: "", truncated: false, binary: false, error: false, size: 0 });
	});

	it("returns a placeholder for a missing file", async () => {
		const r = await previewFile(path.join(tmp, "nope.txt"));
		expect(r).toEqual({
			text: "[cannot read file]",
			truncated: false,
			binary: false,
			error: true,
			size: 0,
		});
	});
});
