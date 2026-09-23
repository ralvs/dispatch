import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

// .mts, not .ts: Vite 8.3 loads a .ts config as CommonJS and warns on every run
// that the ESM syntax here is unsupported by the `native` config loader it plans
// to default to. The extension says ESM outright — which is why the paths below
// use import.meta.dirname rather than __dirname.

// Git worktrees live under .claude/worktrees/ — each is a full checkout, so
// without this every sibling branch's suite runs alongside this one: `bun run
// check` reports another branch's failures as if they were ours.
const exclude = [...configDefaults.exclude, "**/.claude/worktrees/**"];

// Three projects, one per test layer that runs in Vitest (docs/adr/0063).
// `bun run check` runs unit + component and needs no Docker; integration runs
// only through `bun run test:integration`, against the local Supabase stack.
export default defineConfig({
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					environment: "node",
					include: ["**/*.test.ts"],
					exclude: [...exclude, "**/*.int.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "component",
					environment: "happy-dom",
					include: ["**/*.test.tsx"],
					exclude,
					setupFiles: ["test/component/setup.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "integration",
					environment: "node",
					include: ["**/*.int.test.ts"],
					exclude,
					globalSetup: ["test/integration/global-setup.ts"],
					setupFiles: ["test/integration/setup.ts"],
					// One database, reset before every test: files must not interleave.
					fileParallelism: false,
					testTimeout: 20_000,
					hookTimeout: 20_000,
				},
			},
		],
	},
	resolve: {
		alias: {
			"server-only": path.resolve(import.meta.dirname, "test/stubs/empty.ts"),
			"@": path.resolve(import.meta.dirname, "."),
		},
	},
});
