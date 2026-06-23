import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import path from "path";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		environment: "node",
		include: ["test/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/core/**", "src/types.ts"],
		},
	},
	resolve: {
		alias: {
			obsidian: path.resolve(root, "test/mocks/obsidian.ts"),
		},
	},
});
