import { describe, it, expect } from "vitest";
import { Matcher } from "../../src/core/matcher";

function make(candidates: string[], limit = 1000) {
	const m = new Matcher({ limit });
	m.setCandidates(candidates);
	return m;
}

describe("Matcher", () => {
	it("ranks an exact substring above a scattered match", async () => {
		const m = make(["wXaXlXkXeXr", "src/walker.ts"]);
		const r = await m.run("walker");
		expect(r).not.toBeNull();
		expect(r![0]!.rel).toBe("src/walker.ts");
	});

	it("reports positions that cover the matched characters", async () => {
		const m = make(["xabcx"]);
		const r = await m.run("abc");
		expect(r).not.toBeNull();
		const candidate = "xabcx";
		const positions = [...r![0]!.positions].sort((a, b) => a - b);
		expect(positions).toEqual([1, 2, 3]);
		expect(positions.map((p) => candidate[p]).join("")).toBe("abc");
	});

	it("returns up to the limit for an empty query", async () => {
		const m = make(["a", "b", "c", "d", "e"], 3);
		const r = await m.run("");
		expect(r).not.toBeNull();
		expect(r!).toHaveLength(3);
	});

	it("prefers a match in the tail segment (forward: false)", async () => {
		const m = make(["breeds/pyrenees"]);
		const r = await m.run("re");
		expect(r).not.toBeNull();
		const min = Math.min(...r![0]!.positions);
		expect(min).toBeGreaterThanOrEqual(7); // inside "pyrenees", not "breeds"
	});

	it("breaks score ties by shorter candidate first", async () => {
		const m = make(["abxx", "ab"]);
		const r = await m.run("ab");
		expect(r).not.toBeNull();
		expect(r![0]!.rel).toBe("ab");
	});

	it("treats a superseded small-list query as stale (null, never throws)", async () => {
		const m = make(["alpha", "beta", "ab", "abc", "cab"]);
		const p1 = m.run("a");
		const p2 = m.run("ab");
		await expect(p1).resolves.toBeNull();
		const r2 = await p2;
		expect(r2).not.toBeNull();
		expect(r2!.length).toBeGreaterThan(0);
	});

	it("swallows fzf's cancellation on a large list", async () => {
		const big = Array.from({ length: 60000 }, (_, i) => `path/to/file_${i}.ts`);
		const m = make(big);
		const p1 = m.run("file1");
		const p2 = m.run("file2");
		// Neither promise rejects; the stale one is null.
		const [r1, r2] = await Promise.all([p1, p2]);
		expect(r1).toBeNull();
		expect(r2).not.toBeNull();
	});

	it("returns an empty array before candidates are set", async () => {
		const m = new Matcher();
		await expect(m.run("anything")).resolves.toEqual([]);
	});
});
