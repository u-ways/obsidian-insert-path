import { describe, it, expect } from "vitest";
import { clampSplitRatio, SPLIT_MIN, SPLIT_MAX, SPLIT_DEFAULT } from "../../src/types";

describe("clampSplitRatio", () => {
	it("keeps a usable ratio unchanged", () => {
		expect(clampSplitRatio(0.5)).toBe(0.5);
		expect(clampSplitRatio(0.35)).toBe(0.35);
	});

	it("clamps to the min/max bounds", () => {
		expect(clampSplitRatio(0)).toBe(SPLIT_MIN);
		expect(clampSplitRatio(0.05)).toBe(SPLIT_MIN);
		expect(clampSplitRatio(1)).toBe(SPLIT_MAX);
		expect(clampSplitRatio(0.95)).toBe(SPLIT_MAX);
	});

	it("falls back to the default for non-finite values", () => {
		expect(clampSplitRatio(Number.NaN)).toBe(SPLIT_DEFAULT);
		expect(clampSplitRatio(Number.POSITIVE_INFINITY)).toBe(SPLIT_DEFAULT);
	});
});
