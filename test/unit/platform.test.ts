import { describe, it, expect } from "vitest";
import * as os from "os";
import { altKeyLabel, modKeyLabel, resolveDefaultRoot } from "../../src/types";

describe("resolveDefaultRoot", () => {
	it("starts at the vault folder when one is available", () => {
		expect(resolveDefaultRoot("/home/u/Documents/u-notes")).toBe("/home/u/Documents/u-notes");
	});

	it("falls back to the home directory when there is no vault path", () => {
		expect(resolveDefaultRoot(null)).toBe(os.homedir());
	});
});

describe("altKeyLabel", () => {
	it("spells the Alt key as a word off macOS", () => {
		expect(altKeyLabel(false)).toBe("Alt");
	});

	it("uses the Option glyph on macOS", () => {
		expect(altKeyLabel(true)).toBe("⌥");
	});
});

describe("modKeyLabel", () => {
	it("spells the Mod key as Ctrl off macOS", () => {
		expect(modKeyLabel(false)).toBe("Ctrl");
	});

	it("uses the Command glyph on macOS", () => {
		expect(modKeyLabel(true)).toBe("⌘");
	});
});
