import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@/lib/ai/gateway", () => ({
	isAiConfigured: vi.fn(() => true),
	parserModel: vi.fn(() => ({})),
	MODEL_PROVIDER_OPTIONS: { anthropic: { effort: "low" } },
}));
vi.mock("@/lib/services/domains", () => ({ listDomains: vi.fn(async () => []) }));
vi.mock("@/lib/services/projects", () => ({ listProjects: vi.fn(async () => []) }));
vi.mock("@/lib/services/settings", () => ({
	getAppTimezone: vi.fn(async () => "America/Sao_Paulo"),
}));
vi.mock("@/lib/services/tasks", () => ({ createTask: vi.fn() }));

import { generateObject } from "ai";
import { isAiConfigured } from "@/lib/ai/gateway";
import { parseTaskCapture, quickAddTask } from "@/lib/services/capture/quick-add";
import { listDomains } from "@/lib/services/domains";
import { listProjects } from "@/lib/services/projects";
import { createTask } from "@/lib/services/tasks";

const sb = {} as SupabaseClient;
const CTX = { tz: "America/Sao_Paulo", todayIso: "2026-07-15", nowUtc: "2026-07-15T12:00:00Z" };

beforeEach(() => {
	vi.clearAllMocks();
	(isAiConfigured as Mock).mockReturnValue(true);
	(listDomains as Mock).mockResolvedValue([]);
	(listProjects as Mock).mockResolvedValue([]);
});

function parsedTask(task: Record<string, unknown> | null) {
	(generateObject as Mock).mockResolvedValue({ object: { task } });
}

describe("parseTaskCapture", () => {
	it("returns unavailable when the gateway is not configured", async () => {
		(isAiConfigured as Mock).mockReturnValue(false);
		const result = await parseTaskCapture("pagar aluguel", CTX);
		expect(result).toEqual({ ok: false, reason: "unavailable", raw: "pagar aluguel" });
		expect(generateObject).not.toHaveBeenCalled();
	});

	it("returns failed when the model call throws", async () => {
		(generateObject as Mock).mockRejectedValue(new Error("boom"));
		expect(await parseTaskCapture("blah", CTX)).toEqual({
			ok: false,
			reason: "failed",
			raw: "blah",
		});
	});

	it("returns empty when the model finds no task", async () => {
		parsedTask(null);
		expect(await parseTaskCapture("hmm", CTX)).toEqual({
			ok: false,
			reason: "empty",
			raw: "hmm",
		});
	});

	it("returns the parsed task on success", async () => {
		parsedTask({ action: "create_task", title: "pagar aluguel" });
		expect(await parseTaskCapture("pagar aluguel", CTX)).toEqual({
			ok: true,
			task: { action: "create_task", title: "pagar aluguel" },
		});
	});

	it("resolves relative dates against the app timezone", async () => {
		parsedTask(null);
		await parseTaskCapture("hmm", CTX);
		const { system, prompt } = (generateObject as Mock).mock.calls[0][0];
		expect(prompt).toContain('"now": "2026-07-15T12:00:00Z"');
		expect(prompt).toContain('"today": "2026-07-15"');
		expect(prompt).toContain('"timezone": "America/Sao_Paulo"');
		expect(prompt).toContain("<utterance>\nhmm\n</utterance>");
		expect(JSON.stringify(system)).toContain("priority is 1 (high), 2 (medium) or 3 (low).");
	});
});

describe("quickAddTask", () => {
	it("creates the routed, parsed task when parsing succeeds", async () => {
		(listDomains as Mock).mockResolvedValue([{ id: "dom-home", name: "Casa", active: true }]);
		parsedTask({
			action: "create_task",
			title: "pagar aluguel",
			due_date: "2026-07-27",
			domain: "Casa",
		});
		(createTask as Mock).mockResolvedValue({ id: "task-1" });

		const result = await quickAddTask(sb, "pagar aluguel toda segunda em Casa");

		expect(result).toEqual({ task: { id: "task-1" }, parsed: true });
		expect(createTask).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({
				title: "pagar aluguel",
				due_date: "2026-07-27",
				domain_id: "dom-home",
				project_id: null,
				source: "manual",
			}),
			{ graphFail: "swallow" },
		);
	});

	it("lets a stated domain override the one the parser inferred", async () => {
		// The task form's domain field is mandatory while its sentence parsing
		// is not, so a create is legitimately both "read this" and "file it
		// here". Stated beats inferred.
		(listDomains as Mock).mockResolvedValue([
			{ id: "dom-home", name: "Casa", active: true },
			{ id: "dom-work", name: "Trabalho", active: true },
		]);
		parsedTask({ action: "create_task", title: "pagar aluguel", domain: "Casa" });
		(createTask as Mock).mockResolvedValue({ id: "task-3" });

		await quickAddTask(sb, "pagar aluguel", { domainId: "dom-work" });

		expect(createTask).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({ title: "pagar aluguel", domain_id: "dom-work" }),
			{ graphFail: "swallow" },
		);
	});

	describe("when a stated domain disagrees with the parsed project", () => {
		// The pairing the task form was changed to make impossible must not walk
		// back in here: the form's default create IS title-only, so every one of
		// them now arrives with a stated domain.
		beforeEach(() => {
			(listDomains as Mock).mockResolvedValue([
				{ id: "dom-code", name: "Code", active: true },
				{ id: "dom-home", name: "Casa", active: true },
			]);
			(listProjects as Mock).mockResolvedValue([
				{ id: "proj-dispatch", name: "Dispatch", domain_id: "dom-code" },
			]);
			(createTask as Mock).mockResolvedValue({ id: "task-5" });
		});

		it("drops the project rather than filing it under the wrong domain", async () => {
			parsedTask({ action: "create_task", title: "changelog", project: "Dispatch" });

			await quickAddTask(sb, "add a changelog page to Dispatch", { domainId: "dom-home" });

			expect(createTask).toHaveBeenCalledWith(
				sb,
				expect.objectContaining({ domain_id: "dom-home", project_id: null }),
				{ graphFail: "swallow" },
			);
		});

		it("keeps the project when the stated domain is its own", async () => {
			parsedTask({ action: "create_task", title: "changelog", project: "Dispatch" });

			await quickAddTask(sb, "add a changelog page to Dispatch", { domainId: "dom-code" });

			expect(createTask).toHaveBeenCalledWith(
				sb,
				expect.objectContaining({ domain_id: "dom-code", project_id: "proj-dispatch" }),
				{ graphFail: "swallow" },
			);
		});
	});

	it("files a stated domain even when the parse degrades", async () => {
		// The degraded path has no parse to take a domain from, so the stated
		// one is the only filing there is — losing it would drop the task into
		// the inbox the form exists to keep it out of.
		(isAiConfigured as Mock).mockReturnValue(false);
		(createTask as Mock).mockResolvedValue({ id: "task-4" });

		await quickAddTask(sb, "pagar aluguel", { domainId: "dom-work" });

		expect(createTask).toHaveBeenCalledWith(
			sb,
			{ title: "pagar aluguel", domain_id: "dom-work", source: "manual" },
			{ graphFail: "swallow" },
		);
	});

	it.each(["unavailable", "failed", "empty"] as const)(
		"falls back to a raw-title Inbox task when the parser reports %s",
		async (reason) => {
			if (reason === "unavailable") (isAiConfigured as Mock).mockReturnValue(false);
			else if (reason === "failed") (generateObject as Mock).mockRejectedValue(new Error("boom"));
			else parsedTask(null);
			(createTask as Mock).mockResolvedValue({ id: "task-2" });

			const result = await quickAddTask(sb, "  call the dentist  ");

			expect(result).toEqual({ task: { id: "task-2" }, parsed: false });
			expect(createTask).toHaveBeenCalledWith(
				sb,
				{
					title: "call the dentist",
					// No domain was stated, so the degraded task is still unfiled.
					domain_id: null,
					source: "manual",
				},
				{ graphFail: "swallow" },
			);
		},
	);

	it("propagates a createTask rejection", async () => {
		(isAiConfigured as Mock).mockReturnValue(false);
		(createTask as Mock).mockRejectedValue(new Error("db down"));

		await expect(quickAddTask(sb, "x")).rejects.toThrow("db down");
	});

	it("appends unresolved routing mentions to notes", async () => {
		parsedTask({ action: "create_task", title: "ship it", project: "Ghost project" });
		(createTask as Mock).mockResolvedValue({ id: "task-3" });

		await quickAddTask(sb, "ship it for Ghost project");

		expect(createTask).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({
				domain_id: null,
				project_id: null,
				notes: '[capture: unresolved project "Ghost project"]',
			}),
			{ graphFail: "swallow" },
		);
	});

	it("passes graphFail swallow into createTask (iron rule #4)", async () => {
		parsedTask({ action: "create_task", title: "call @Ana" });
		(createTask as Mock).mockResolvedValue({ id: "task-5", title: "call @Ana", notes: null });

		const result = await quickAddTask(sb, "call @Ana");

		expect(result).toEqual({
			task: { id: "task-5", title: "call @Ana", notes: null },
			parsed: true,
		});
		expect(createTask).toHaveBeenCalledWith(sb, expect.objectContaining({ title: "call @Ana" }), {
			graphFail: "swallow",
		});
	});

	it("still parses (unrouted) when the routing-list fetch throws — guarded", async () => {
		(listDomains as Mock).mockRejectedValue(new Error("db down"));
		parsedTask({ action: "create_task", title: "ship it" });
		(createTask as Mock).mockResolvedValue({ id: "task-4" });

		const result = await quickAddTask(sb, "ship it");

		expect(result).toEqual({ task: { id: "task-4" }, parsed: true });
		expect(createTask).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({ domain_id: null, project_id: null }),
			{ graphFail: "swallow" },
		);
	});
});
