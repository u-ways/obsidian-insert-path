import { describe, it, expect } from "vitest";
import { prismLangFor, shouldHighlight, type HighlightLimits } from "../../src/core/prism";
import type { FilePreview } from "../../src/core/preview";

describe("prismLangFor", () => {
	it("maps known extensions to Prism language ids", () => {
		expect(prismLangFor("/a/b/c.ts")).toBe("typescript");
		expect(prismLangFor("/a/b/c.tsx")).toBe("tsx");
		expect(prismLangFor("/x/script.sh")).toBe("bash");
		expect(prismLangFor("/x/Main.kt")).toBe("kotlin");
		expect(prismLangFor("/x/header.h")).toBe("c");
		expect(prismLangFor("/x/data.yml")).toBe("yaml");
	});

	it("is case-insensitive on the extension", () => {
		expect(prismLangFor("/a/B/C.TS")).toBe("typescript");
	});

	it("recognizes well-known extensionless filenames", () => {
		expect(prismLangFor("/proj/Dockerfile")).toBe("docker");
		expect(prismLangFor("/proj/Makefile")).toBe("makefile");
	});

	it("returns null for dotfiles, extensionless, and unknown extensions", () => {
		expect(prismLangFor("/home/u/.gitignore")).toBeNull();
		expect(prismLangFor("/home/u/README")).toBeNull();
		expect(prismLangFor("/home/u/data.unknownext")).toBeNull();
	});

	it("uses the last dot for multi-dot filenames", () => {
		expect(prismLangFor("/x/component.test.ts")).toBe("typescript");
		expect(prismLangFor("/x/archive.tar.gz")).toBeNull();
	});
});

const base: FilePreview = {
	text: "const x = 1;\n",
	truncated: false,
	binary: false,
	error: false,
	size: 100,
};
const limits: HighlightLimits = { maxHighlightBytes: 1024 * 1024, maxHighlightLineLength: 5000 };

describe("shouldHighlight", () => {
	it("highlights a normal small text file", () => {
		expect(shouldHighlight(base, limits)).toBe(true);
	});

	it("skips binary and unreadable previews", () => {
		expect(shouldHighlight({ ...base, binary: true }, limits)).toBe(false);
		expect(shouldHighlight({ ...base, error: true }, limits)).toBe(false);
	});

	it("skips files larger than the size limit", () => {
		expect(shouldHighlight({ ...base, size: 2 * 1024 * 1024 }, limits)).toBe(false);
	});

	it("ignores the size limit when it is 0", () => {
		expect(shouldHighlight({ ...base, size: 9e9 }, { ...limits, maxHighlightBytes: 0 })).toBe(
			true,
		);
	});

	it("skips a head containing a very long line (minified)", () => {
		expect(shouldHighlight({ ...base, text: "x".repeat(6000) }, limits)).toBe(false);
	});

	it("allows a long line when the line guard is 0", () => {
		expect(
			shouldHighlight(
				{ ...base, text: "x".repeat(6000) },
				{ ...limits, maxHighlightLineLength: 0 },
			),
		).toBe(true);
	});

	it("measures lines independently (many short lines, large total)", () => {
		const many = Array.from({ length: 500 }, () => "short line").join("\n");
		expect(shouldHighlight({ ...base, text: many }, limits)).toBe(true);
	});

	it("detects a long final line with no trailing newline", () => {
		expect(shouldHighlight({ ...base, text: "ok\n" + "y".repeat(6000) }, limits)).toBe(false);
	});
});
