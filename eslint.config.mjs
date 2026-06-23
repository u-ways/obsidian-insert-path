import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import obsidianmd from "eslint-plugin-obsidianmd";

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

// Obsidian's official guideline rules. We take only the `obsidianmd/*` rules from the
// recommended preset — NOT the transitive import/security/sdl plugins it also bundles —
// and apply them to shipped plugin source only. This keeps the type-checked rules off
// our .mjs config/build files (which the full preset chokes on) while still validating
// the code that actually ships.
const obsidianmdRules = Object.fromEntries(
	obsidianmd.configs.recommended
		.flatMap((cfg) => Object.entries(cfg.rules ?? {}))
		.filter(([name]) => name.startsWith("obsidianmd/")),
);

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
	{
		// Obsidian guideline rules, scoped to shipped plugin source only and type-aware
		// via the src tsconfig. no-nodejs-modules is off: the plugin is isDesktopOnly and
		// all disk access goes through the read-only core/fs-read facade.
		files: ["src/**/*.ts"],
		plugins: { obsidianmd },
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
		},
		rules: {
			...obsidianmdRules,
			"obsidianmd/no-nodejs-modules": "off",
		},
	},
);
