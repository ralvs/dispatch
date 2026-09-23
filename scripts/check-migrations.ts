// Guards supabase/migrations on a PR (docs/adr/0065).
//
//   bun scripts/check-migrations.ts origin/main
//
// Production applies migrations with `supabase db push`, which runs a file
// only when its version is missing from the history table. So:
// - an applied file is never edited, renamed or deleted — the change would
//   never reach production (20260714194155_schema.sql was edited in July and
//   still differs from what ran). Write a new migration instead;
// - a new file sorts after every file on the base branch — `db push` refuses
//   a version older than the newest one already applied.

import { execFileSync } from "node:child_process";

const DIR = "supabase/migrations/";
const FILE = /^(\d{14})_[a-z0-9_]+\.sql$/;

export type Change = { status: string; path: string };

export function checkMigrations(baseFiles: string[], changes: Change[]): string[] {
	const problems: string[] = [];
	const newestOnBase = baseFiles
		.map((name) => FILE.exec(name)?.[1])
		.filter((version): version is string => version !== undefined)
		.sort()
		.at(-1);
	const added = new Set<string>();

	for (const { status, path } of changes) {
		const name = path.slice(DIR.length);
		if (status !== "A") {
			problems.push(`${name}: an applied migration is never changed (${status}). Add a new one.`);
			continue;
		}
		const version = FILE.exec(name)?.[1];
		if (!version) {
			problems.push(`${name}: name must be <14-digit UTC timestamp>_<snake_case>.sql.`);
			continue;
		}
		if (added.has(version)) problems.push(`${name}: another new migration has version ${version}.`);
		added.add(version);
		if (newestOnBase && version <= newestOnBase) {
			problems.push(`${name}: must sort after ${newestOnBase}, the newest migration on the base.`);
		}
	}
	return problems;
}

function git(...args: string[]): string {
	return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function main(): number {
	const base = process.argv[2];
	if (!base) {
		console.error("Usage: bun scripts/check-migrations.ts <base ref>");
		return 1;
	}
	const baseFiles = git("ls-tree", "--name-only", base, DIR)
		.split("\n")
		.filter(Boolean)
		.map((path) => path.slice(DIR.length));
	// --no-renames: a rename shows as D + A, so the D is caught.
	const changes = git("diff", "--name-status", "--no-renames", `${base}...HEAD`, "--", DIR)
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const [status = "", path = ""] = line.split("\t");
			return { status: status.charAt(0), path };
		});

	const problems = checkMigrations(baseFiles, changes);
	if (problems.length > 0) {
		for (const problem of problems) console.error(problem);
		return 1;
	}
	const count = changes.length;
	console.log(count === 0 ? "No migration changes." : `${count} new migration(s), all in order.`);
	return 0;
}

if (import.meta.main) {
	process.exit(main());
}
