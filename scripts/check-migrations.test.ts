import { describe, expect, it } from "vitest";
import { checkMigrations } from "./check-migrations";

const BASE = [
	"20260919140000_priority_three_levels.sql",
	"20260922120000_explicit_public_grants.sql",
];
const at = (name: string) => `supabase/migrations/${name}`;

describe("checkMigrations", () => {
	it("passes a PR with no migration changes", () => {
		expect(checkMigrations(BASE, [])).toEqual([]);
	});

	it("passes a new migration newer than the base", () => {
		expect(
			checkMigrations(BASE, [{ status: "A", path: at("20260923120000_link_image.sql") }]),
		).toEqual([]);
	});

	it("rejects a new migration older than the newest on the base", () => {
		const problems = checkMigrations(BASE, [{ status: "A", path: at("20260920000000_late.sql") }]);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain("must sort after 20260922120000");
	});

	it("rejects an edited, deleted or renamed migration", () => {
		const problems = checkMigrations(BASE, [
			{ status: "M", path: at("20260919140000_priority_three_levels.sql") },
			{ status: "D", path: at("20260922120000_explicit_public_grants.sql") },
		]);
		expect(problems).toHaveLength(2);
		expect(problems.every((p) => p.includes("never changed"))).toBe(true);
	});

	it("rejects a badly named file", () => {
		const problems = checkMigrations(BASE, [{ status: "A", path: at("0008_link_image.sql") }]);
		expect(problems[0]).toContain("name must be");
	});

	it("rejects two new migrations with the same version", () => {
		const problems = checkMigrations(BASE, [
			{ status: "A", path: at("20260923120000_a.sql") },
			{ status: "A", path: at("20260923120000_b.sql") },
		]);
		expect(problems).toEqual([
			expect.stringContaining("another new migration has version 20260923120000"),
		]);
	});
});
