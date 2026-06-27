import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, resolveAction } from "../../src/types";

describe("resolveAction", () => {
	it("uses the configured primary action when no modifier is held", () => {
		expect(resolveAction("insert", false)).toBe("insert");
		expect(resolveAction("open", false)).toBe("open");
	});

	it("uses the other action when the modifier (Alt) is held", () => {
		expect(resolveAction("insert", true)).toBe("open");
		expect(resolveAction("open", true)).toBe("insert");
	});

	it("is its own inverse: applying the modifier twice returns the primary", () => {
		for (const primary of ["insert", "open"] as const) {
			const once = resolveAction(primary, true);
			expect(resolveAction(once, true)).toBe(primary);
		}
	});
});

describe("DEFAULT_SETTINGS.primaryAction", () => {
	it("defaults to insert (Enter/click insert, Alt opens)", () => {
		expect(DEFAULT_SETTINGS.primaryAction).toBe("insert");
	});
});
