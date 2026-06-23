import { describe, it, expect } from "vitest";
import { addRecentRoot } from "../../src/core/recent";

describe("addRecentRoot", () => {
	it("adds a new root to the front", () => {
		expect(addRecentRoot(["/b", "/c"], "/a")).toEqual(["/a", "/b", "/c"]);
	});

	it("moves an existing root to the front without duplicating", () => {
		expect(addRecentRoot(["/a", "/b", "/c"], "/c")).toEqual(["/c", "/a", "/b"]);
	});

	it("caps the list at the limit, dropping the oldest", () => {
		const recents = ["/1", "/2", "/3", "/4", "/5"];
		expect(addRecentRoot(recents, "/new", 5)).toEqual(["/new", "/1", "/2", "/3", "/4"]);
	});

	it("trims surrounding whitespace", () => {
		expect(addRecentRoot([], "  /a  ")).toEqual(["/a"]);
	});

	it("treats a trailing slash as the same root", () => {
		expect(addRecentRoot(["/a"], "/a/")).toEqual(["/a"]);
	});

	it("ignores empty / whitespace-only input", () => {
		expect(addRecentRoot(["/a", "/b"], "   ")).toEqual(["/a", "/b"]);
		expect(addRecentRoot(["/a", "/b"], "")).toEqual(["/a", "/b"]);
	});

	it("preserves the root filesystem path '/'", () => {
		expect(addRecentRoot([], "/")).toEqual(["/"]);
	});

	it("does not mutate the input array", () => {
		const recents = ["/a", "/b"];
		addRecentRoot(recents, "/c");
		expect(recents).toEqual(["/a", "/b"]);
	});
});
