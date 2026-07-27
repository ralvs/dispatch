import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { CreateTaskAction } from "@/lib/schemas/capture";
import {
	fetchRoutingLists,
	type RoutingLists,
	resolveTaskRouting,
	taskInputFromAction,
} from "@/lib/services/capture/resolve";

vi.mock("@/lib/services/domains", () => ({ listDomains: vi.fn() }));
vi.mock("@/lib/services/projects", () => ({ listProjects: vi.fn() }));

import { listDomains } from "@/lib/services/domains";
import { listProjects } from "@/lib/services/projects";

const sb = {} as SupabaseClient;

const LISTS: RoutingLists = {
	domains: [
		{ id: "dom-home", name: "Home" },
		{ id: "dom-work", name: "Work" },
	],
	projects: [{ id: "proj-reviews", name: "Reviews", domain_id: "dom-work" }],
};

function task(overrides: Partial<CreateTaskAction> = {}): CreateTaskAction {
	return { action: "create_task", title: "water plants", ...overrides };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("resolveTaskRouting", () => {
	it("matches a project case- and diacritic-insensitively and inherits its domain", () => {
		const result = resolveTaskRouting(task({ project: "revíews" }), LISTS);
		expect(result).toEqual({ domain_id: "dom-work", project_id: "proj-reviews", unresolved: [] });
	});

	it("matches a domain case-insensitively", () => {
		const result = resolveTaskRouting(task({ domain: "HOME" }), LISTS);
		expect(result).toEqual({ domain_id: "dom-home", project_id: null, unresolved: [] });
	});

	it("an explicitly resolved domain wins over a resolved project's inherited domain", () => {
		const result = resolveTaskRouting(task({ project: "Reviews", domain: "Home" }), LISTS);
		expect(result).toEqual({ domain_id: "dom-home", project_id: "proj-reviews", unresolved: [] });
	});

	it("reports a miss instead of guessing, and falls back to no routing", () => {
		const result = resolveTaskRouting(task({ project: "Reviews plugin" }), LISTS);
		expect(result).toEqual({
			domain_id: null,
			project_id: null,
			unresolved: ['project "Reviews plugin"'],
		});
	});

	it("reports both misses when neither domain nor project match", () => {
		const result = resolveTaskRouting(task({ domain: "Nope", project: "Also nope" }), LISTS);
		expect(result.unresolved).toEqual(['project "Also nope"', 'domain "Nope"']);
	});

	it("returns no routing when the action names neither domain nor project", () => {
		const result = resolveTaskRouting(task(), LISTS);
		expect(result).toEqual({ domain_id: null, project_id: null, unresolved: [] });
	});

	it("finds no match against empty lists", () => {
		const result = resolveTaskRouting(task({ domain: "Home" }), { domains: [], projects: [] });
		expect(result.unresolved).toEqual(['domain "Home"']);
	});
});

describe("taskInputFromAction", () => {
	it("maps every field of a fully specified action", () => {
		const input = taskInputFromAction(
			task({
				title: "revisar o PR",
				notes: "antes da daily",
				due_date: "2026-07-30",
				due_time: "09:15",
				priority: 2,
				recurrence_rule: "weekly",
				project: "Reviews",
			}),
			LISTS,
		);

		expect(input).toEqual({
			title: "revisar o PR",
			notes: "antes da daily",
			due_date: "2026-07-30",
			due_time: "09:15",
			priority: 2,
			domain_id: "dom-work",
			project_id: "proj-reviews",
			recurrence_rule: "weekly",
			source: "manual",
		});
	});

	it("nulls the omitted optional fields rather than leaving them undefined", () => {
		const input = taskInputFromAction(task(), LISTS);

		expect(input).toEqual({
			title: "water plants",
			notes: null,
			due_date: null,
			due_time: null,
			priority: undefined,
			domain_id: null,
			project_id: null,
			recurrence_rule: null,
			source: "manual",
		});
	});

	it("folds unresolved routing mentions into the notes", () => {
		const input = taskInputFromAction(
			task({ notes: "detalhe", domain: "Nope", project: "Also nope" }),
			LISTS,
		);

		expect(input.notes).toBe(
			'detalhe\n[capture: unresolved project "Also nope"] [capture: unresolved domain "Nope"]',
		);
		expect(input.domain_id).toBeNull();
	});

	it("makes the unresolved mentions the whole note when the action had none", () => {
		const input = taskInputFromAction(task({ domain: "Nope" }), LISTS);
		expect(input.notes).toBe('[capture: unresolved domain "Nope"]');
	});
});

describe("fetchRoutingLists", () => {
	it("maps non-system domains and active projects", async () => {
		(listDomains as Mock).mockResolvedValue([
			{ id: "dom-home", name: "Home", is_system: false },
			{ id: "dom-inbox", name: "Inbox", is_system: true },
		]);
		(listProjects as Mock).mockResolvedValue([
			{ id: "proj-reviews", name: "Reviews", domain_id: "dom-work" },
		]);

		const result = await fetchRoutingLists(sb);

		expect(result).toEqual({
			domains: [{ id: "dom-home", name: "Home" }],
			projects: [{ id: "proj-reviews", name: "Reviews", domain_id: "dom-work" }],
		});
		expect(listProjects).toHaveBeenCalledWith(sb, { status: "active" });
	});

	it("degrades to empty lists when a fetch throws", async () => {
		(listDomains as Mock).mockRejectedValue(new Error("db down"));
		(listProjects as Mock).mockResolvedValue([]);

		const result = await fetchRoutingLists(sb);

		expect(result).toEqual({ domains: [], projects: [] });
	});
});
