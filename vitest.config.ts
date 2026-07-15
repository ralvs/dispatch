import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// Phase 0 has no tests yet; `bun run check` must still pass.
		passWithNoTests: true,
	},
	resolve: {
		alias: {
			"server-only": path.resolve(__dirname, "test/stubs/empty.ts"),
			"@": path.resolve(__dirname, "."),
		},
	},
});
