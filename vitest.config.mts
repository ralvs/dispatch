import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

// .mts, not .ts: Vite 8.3 loads a .ts config as CommonJS and warns on every run
// that the ESM syntax here is unsupported by the `native` config loader it plans
// to default to. The extension says ESM outright — which is why the paths below
// use import.meta.dirname rather than __dirname.

export default defineConfig({
	test: {
		environment: "node",
		// Phase 0 has no tests yet; `bun run check` must still pass.
		passWithNoTests: true,
		// Git worktrees live under .claude/worktrees/ — each is a full checkout,
		// so without this every sibling branch's suite runs alongside this one:
		// `bun run check` reports another branch's failures as if they were ours.
		exclude: [...configDefaults.exclude, "**/.claude/worktrees/**"],
	},
	resolve: {
		alias: {
			"server-only": path.resolve(import.meta.dirname, "test/stubs/empty.ts"),
			"@": path.resolve(import.meta.dirname, "."),
		},
	},
});
