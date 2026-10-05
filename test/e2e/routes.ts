import { readdirSync } from "node:fs";
import path from "node:path";

const AUTHED = path.join(process.cwd(), "app", "(authed)");

/**
 * Every authed route, read from `app/(authed)/**\/page.tsx` so a new route is
 * covered without touching the suite. Route groups `(x)` drop out of the URL;
 * dynamic segments stay as `[id]` for the caller to fill with a seeded id.
 * Parallel-route slots `@x` are not routes of their own: `@modal` only ever
 * draws over one (docs/adr/0079).
 */
export function authedRoutes(): string[] {
	const routes: string[] = [];
	const walk = (dir: string, segments: string[]) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (entry.name.startsWith("@")) continue;
				const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
				walk(path.join(dir, entry.name), isGroup ? segments : [...segments, entry.name]);
			} else if (entry.name === "page.tsx") {
				routes.push(`/${segments.join("/")}`);
			}
		}
	};
	walk(AUTHED, []);
	return routes.sort();
}
