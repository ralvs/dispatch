import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { CreateTaskAction } from "@/lib/schemas/capture";
import {
	fetchRoutingLists,
	loadCaptureContext,
	type RoutingLists,
	resolveTaskRouting,
	taskInputFromAction,
} from "@/lib/services/capture/resolve";

vi.mock("@/lib/services/domains", () => ({ listDomains: vi.fn() }));
vi.mock("@/lib/services/projects", () => ({ listProjects: vi.fn() }));
vi.mock("@/lib/services/settings", () => ({ getAppTimezone: vi.fn() }));

import { listDomains } from "@/lib/services/domains";
import { listProjects } from "@/lib/services/projects";
import { getAppTimezone } from "@/lib/services/settings";

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

	it("keeps the project's own domain when the action names a different one", () => {
		// This used to be "an explicit domain wins", which stored a task in a
		// Work project under Home — a pair the data cannot mean. Both answers
		// come from the same model here, and naming a project already names a
		// domain, so a contradicting domain is the model's mistake.
		const result = resolveTaskRouting(task({ project: "Reviews", domain: "Home" }), LISTS);
		expect(result).toEqual({ domain_id: "dom-work", project_id: "proj-reviews", unresolved: [] });
	});

	it("still reports an unmatched domain name even when the project decided", () => {
		const result = resolveTaskRouting(task({ project: "Reviews", domain: "Nope" }), LISTS);
		expect(result).toEqual({
			domain_id: "dom-work",
			project_id: "proj-reviews",
			unresolved: ['domain "Nope"'],
		});
	});

	it("reports a miss instead of guessing, and falls back to no routing", () => {
		const result = resolveTaskRouting(task({ project: "Garden plugin" }), LISTS);
		expect(result).toEqual({
			domain_id: null,
			project_id: null,
			unresolved: ['project "Garden plugin"'],
		});
	});

	it("fuzzy-matches a project phrase the user said", () => {
		const result = resolveTaskRouting(
			task({ project: "the Reviews plugin" }),
			LISTS,
			"ship it on the Reviews plugin",
		);
		expect(result).toEqual({ domain_id: "dom-work", project_id: "proj-reviews", unresolved: [] });
	});

	it("never fuzzy-matches a phrase the user did not say", () => {
		// The model's own filler must not become a filing decision.
		const result = resolveTaskRouting(task({ project: "reviews stuff" }), LISTS, "water plants");
		expect(result).toEqual({ domain_id: null, project_id: null, unresolved: [] });
	});

	it("does not fuzzy-match a domain name echoed into project", () => {
		const lists: RoutingLists = {
			...LISTS,
			projects: [{ id: "proj-office", name: "Home office", domain_id: "dom-home" }],
		};
		const result = resolveTaskRouting(
			task({ project: "Home", domain: "Home" }),
			lists,
			"home: fix the sink",
		);
		expect(result).toEqual({ domain_id: "dom-home", project_id: null, unresolved: [] });
	});

	it("reports both misses when neither domain nor project match", () => {
		const result = resolveTaskRouting(task({ domain: "Nope", project: "Also nope" }), LISTS);
		expect(result.unresolved).toEqual(['project "Also nope"', 'domain "Nope"']);
	});

	it("returns no routing when the action names neither domain nor project", () => {
		const result = resolveTaskRouting(task(), LISTS);
		expect(result).toEqual({ domain_id: null, project_id: null, unresolved: [] });
	});

	it("drops an unmatched name the utterance never contained", () => {
		// A word-shaped stand-in the model wrote into a field it was told to
		// leave out. It is not a miss worth carrying to /inbox; it is noise.
		const result = resolveTaskRouting(task({ project: "skip" }), LISTS, "gym every Tuesday");
		expect(result).toEqual({ domain_id: null, project_id: null, unresolved: [] });
	});

	it("still reports an unmatched name the utterance really did contain", () => {
		const result = resolveTaskRouting(
			task({ project: "Garden plugin" }),
			LISTS,
			"ship it on the Garden plugin",
		);
		expect(result.unresolved).toEqual(['project "Garden plugin"']);
	});

	it("reports every unmatched name when given no utterance to check against", () => {
		const result = resolveTaskRouting(task({ project: "Ghost" }), LISTS);
		expect(result.unresolved).toEqual(['project "Ghost"']);
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
	it("maps domains down to id/name and keeps active projects", async () => {
		(listDomains as Mock).mockResolvedValue([
			{ id: "dom-home", name: "Home", active: true, color: null },
			{ id: "dom-work", name: "Work", active: true, color: "#abc" },
		]);
		(listProjects as Mock).mockResolvedValue([
			{ id: "proj-reviews", name: "Reviews", domain_id: "dom-work" },
		]);

		const result = await fetchRoutingLists(sb);

		expect(result).toEqual({
			domains: [
				{ id: "dom-home", name: "Home" },
				{ id: "dom-work", name: "Work" },
			],
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

describe("loadCaptureContext", () => {
	it("loads timezone and routing lists together", async () => {
		(getAppTimezone as Mock).mockResolvedValue("America/Sao_Paulo");
		(listDomains as Mock).mockResolvedValue([{ id: "dom-home", name: "Home" }]);
		(listProjects as Mock).mockResolvedValue([
			{ id: "proj-reviews", name: "Reviews", domain_id: "dom-work" },
		]);

		const result = await loadCaptureContext(sb);

		expect(getAppTimezone).toHaveBeenCalledWith(sb);
		expect(listDomains).toHaveBeenCalledWith(sb);
		expect(listProjects).toHaveBeenCalledWith(sb, { status: "active" });
		expect(result.tz).toBe("America/Sao_Paulo");
		expect(result.routing).toEqual({
			domains: [{ id: "dom-home", name: "Home" }],
			projects: [{ id: "proj-reviews", name: "Reviews", domain_id: "dom-work" }],
		});
		expect(result.ctx.tz).toBe("America/Sao_Paulo");
		expect(result.ctx.domains).toEqual(["Home"]);
		// dom-work is not in the domain list, so the project goes unpaired.
		expect(result.ctx.projects).toEqual([{ name: "Reviews" }]);
	});

	it("pairs each project with its domain's name", async () => {
		(getAppTimezone as Mock).mockResolvedValue("America/Sao_Paulo");
		(listDomains as Mock).mockResolvedValue([{ id: "dom-home", name: "Home" }]);
		(listProjects as Mock).mockResolvedValue([
			{ id: "proj-move", name: "Apartment move", domain_id: "dom-home" },
		]);

		const result = await loadCaptureContext(sb);

		expect(result.ctx.projects).toEqual([{ name: "Apartment move", domain: "Home" }]);
	});
});
