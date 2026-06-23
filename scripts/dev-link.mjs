// Symlink the built plugin into an Obsidian vault for live development.
//
// Set DEFAULT_OBSIDIAN_VAULT to the absolute path of YOUR Obsidian vault, e.g.
//   export DEFAULT_OBSIDIAN_VAULT="$HOME/Documents/MyVault"
// (or prefix the command: DEFAULT_OBSIDIAN_VAULT="..." npm run dev:link). The script
// errors if it is unset — there is no built-in default vault.
//
// Links manifest.json, main.js and styles.css into
// <vault>/.obsidian/plugins/insert-path/ and drops an empty `.hotreload` marker
// so pjeby's Hot Reload plugin reloads on every esbuild rebuild.

import { mkdir, writeFile, rm, symlink, access } from "fs/promises";
import { fileURLToPath } from "url";
import * as path from "path";
import process from "process";

const PLUGIN_ID = "insert-path";

const vault = process.env.DEFAULT_OBSIDIAN_VAULT?.trim();
if (!vault) {
	console.error(
		"dev:link: DEFAULT_OBSIDIAN_VAULT is not set.\n" +
			'Set it to your Obsidian vault path, e.g.\n  export DEFAULT_OBSIDIAN_VAULT="$HOME/Documents/MyVault"',
	);
	process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = path.join(vault, ".obsidian", "plugins", PLUGIN_ID);
const files = ["manifest.json", "main.js", "styles.css"];

await mkdir(pluginDir, { recursive: true });

for (const file of files) {
	const src = path.join(repoRoot, file);
	const dest = path.join(pluginDir, file);
	await rm(dest, { force: true });
	await symlink(src, dest);
	try {
		await access(src);
	} catch {
		console.warn(
			`  note: ${file} does not exist yet — run \`npm run dev\` (or \`npm run build\`)`,
		);
	}
}

await writeFile(path.join(pluginDir, ".hotreload"), "");

console.log(`Linked Insert Path into:\n  ${pluginDir}`);
console.log("Enable 'Insert Path' (and pjeby 'Hot Reload') under Settings → Community plugins.");
