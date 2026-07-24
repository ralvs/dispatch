import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

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
			"server-only": path.resolve(__dirname, "test/stubs/empty.ts"),
			"@": path.resolve(__dirname, "."),
		},
	},
});
