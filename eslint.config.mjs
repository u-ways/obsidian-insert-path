import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

// Enforce the Obsidian guideline that matters most for a DOM-building plugin:
// never inject raw HTML — build nodes with createEl()/createDiv()/createSpan() and empty().
const noRawHtmlRules = {
	"no-restricted-properties": [
		"error",
		{
			property: "innerHTML",
			message:
				"Use createEl()/createDiv()/empty() instead of innerHTML (Obsidian guideline).",
		},
		{
			property: "outerHTML",
			message: "Use DOM builders instead of outerHTML (Obsidian guideline).",
		},
	],
	"no-restricted-syntax": [
		"error",
		{
			selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
			message: "Use DOM builders instead of insertAdjacentHTML (Obsidian guideline).",
		},
	],
};

// Keep the shipped plugin's filesystem access read-only: it may touch the disk only
// through src/core/fs-read.ts (the read-only facade), never `fs`/`node:fs` directly,
// so no write/create/delete API is reachable from the bundle. (Tests and dev scripts
// outside src/ are free to use fs.)
const noFsMessage =
	"Touch the filesystem only through core/fs-read (the read-only fs facade), never 'fs' directly.";
const noDirectFsImport = {
	"no-restricted-imports": [
		"error",
		{
			paths: [
				{ name: "fs", message: noFsMessage },
				{ name: "node:fs", message: noFsMessage },
				{ name: "fs/promises", message: noFsMessage },
				{ name: "node:fs/promises", message: noFsMessage },
			],
		},
	],
};

export default tseslint.config(
	{
		ignores: ["main.js", "coverage/**", "node_modules/**"],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.{ts,mts,mjs,js}"],
		languageOptions: {
			globals: { ...globals.node, ...globals.browser },
		},
		rules: {
			...noRawHtmlRules,
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
		},
	},
	{
		files: ["src/**/*.ts"],
		ignores: ["src/core/fs-read.ts"],
		rules: { ...noDirectFsImport },
	},
);
