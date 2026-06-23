import { describe, it, expect } from "vitest";
import { buildInsertion } from "../../src/core/insert";

const ctx = { abs: "/home/u/github/mns/docs", rel: "github/mns/docs" };

describe("buildInsertion", () => {
	it("{path} expands to the absolute path", () => {
		expect(buildInsertion("{path}", ctx)).toBe("/home/u/github/mns/docs");
	});

	it("{name} expands to the basename", () => {
		expect(buildInsertion("{name}", ctx)).toBe("docs");
	});

	it("{rel} expands to the relative path", () => {
		expect(buildInsertion("{rel}", ctx)).toBe("github/mns/docs");
	});

	it("wraps the path in inline code", () => {
		expect(buildInsertion("`{path}`", ctx)).toBe("`/home/u/github/mns/docs`");
	});

	it("supports multiple tokens in one template (markdown link)", () => {
		expect(buildInsertion("[{name}]({path})", ctx)).toBe("[docs](/home/u/github/mns/docs)");
	});

	it("returns a template with no tokens verbatim", () => {
		expect(buildInsertion("see notes", ctx)).toBe("see notes");
	});

	it("leaves unknown tokens untouched", () => {
		expect(buildInsertion("{path} {bogus}", ctx)).toBe("/home/u/github/mns/docs {bogus}");
	});

	it("does not re-expand token-like text produced by a replacement", () => {
		const tricky = { abs: "/tmp/{name}", rel: "x" };
		expect(buildInsertion("{path}", tricky)).toBe("/tmp/{name}");
	});

	it("handles a trailing-slash path basename", () => {
		expect(buildInsertion("{name}", { abs: "/home/u/", rel: "" })).toBe("u");
	});
});
