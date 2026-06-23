import * as path from "path";

export interface InsertionContext {
	/** Absolute path to the chosen entry. */
	abs: string;
	/** Path relative to the walk root. */
	rel: string;
}

const TOKEN = /\{(path|name|rel)\}/g;

/**
 * Build the text inserted at the cursor from a user template.
 *
 * Tokens: `{path}` → absolute path, `{name}` → basename, `{rel}` → relative path.
 * Replacement is single-pass, so token-like text inside a path is never re-expanded,
 * and unknown tokens / literal text are preserved.
 */
export function buildInsertion(template: string, ctx: InsertionContext): string {
	const name = path.basename(ctx.abs);
	return template.replace(TOKEN, (_match, token: string) => {
		switch (token) {
			case "path":
				return ctx.abs;
			case "name":
				return name;
			case "rel":
				return ctx.rel;
			default:
				return _match;
		}
	});
}
