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
);
