import { describe, it, expect } from "vitest";
import { InsertPathSettingTab } from "../../src/ui/settings";
import { RootSwitcher } from "../../src/ui/RootSwitcher";
import { InsertPathModal } from "../../src/ui/InsertPathModal";

// The UI layer imports `obsidian`, which only resolves to the real runtime
// inside Obsidian. These smoke tests confirm the vitest alias to the stub lets
// the thin UI modules load (i.e. our `import type` discipline keeps type-only
// imports from leaking into the runtime bundle).
describe("ui module imports", () => {
	it("loads the settings tab class", () => {
		expect(typeof InsertPathSettingTab).toBe("function");
	});

	it("loads the root switcher class", () => {
		expect(typeof RootSwitcher).toBe("function");
	});

	it("loads the picker modal class", () => {
		expect(typeof InsertPathModal).toBe("function");
	});
});
