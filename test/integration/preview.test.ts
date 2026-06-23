import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fsp } from "fs";
import * as os from "os";
import * as path from "path";
import { previewDir, previewFile } from "../../src/core/preview";

let tmp: string;

async function write(rel: string, content = "") {
	const full = path.join(tmp, rel);
	await fsp.mkdir(path.dirname(full), { recursive: true });
	await fsp.writeFile(full, content);
	return full;
}

beforeEach(async () => {
	tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "ip-preview-"));
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

	it("does not descend past level 2 (sub/ children are hidden)", async () => {
		await write("p/beta/sub/deep.txt");
		const tree = await previewDir(path.join(tmp, "p"));
		expect(tree).toContain("sub/");
		expect(tree).not.toContain("deep.txt");
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

describe("previewFile", () => {
	it("returns the head of a small text file", async () => {
		const f = await write("a.txt", "line1\nline2\nline3");
		const r = await previewFile(f);
		expect(r).toEqual({ text: "line1\nline2\nline3", truncated: false, binary: false });
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
		expect(r).toEqual({ text: "[binary file]", truncated: false, binary: true });
	});

	it("only reads up to maxBytes on a large file", async () => {
		const f = await write("huge.txt", "x".repeat(1_000_000));
		const r = await previewFile(f, { maxBytes: 100, maxLines: 1000 });
		expect(r.binary).toBe(false);
		expect(r.truncated).toBe(true);
		expect(r.text.length).toBeLessThanOrEqual(100);
	});

	it("handles an empty file gracefully", async () => {
		const f = await write("empty.txt", "");
		const r = await previewFile(f);
		expect(r).toEqual({ text: "", truncated: false, binary: false });
	});

	it("returns a placeholder for a missing file", async () => {
		const r = await previewFile(path.join(tmp, "nope.txt"));
		expect(r).toEqual({ text: "[cannot read file]", truncated: false, binary: false });
	});
});
