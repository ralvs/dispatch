import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { quickAddTask } from "@/lib/services/capture/quick-add";

vi.mock("@/lib/ai/parser", () => ({ parseTaskCapture: vi.fn() }));
vi.mock("@/lib/services/domains", () => ({ listDomains: vi.fn(async () => []) }));
vi.mock("@/lib/services/projects", () => ({ listProjects: vi.fn(async () => []) }));
vi.mock("@/lib/services/settings", () => ({
	getAppTimezone: vi.fn(async () => "America/Sao_Paulo"),
}));
vi.mock("@/lib/services/tasks", () => ({ createTask: vi.fn() }));
vi.mock("@/lib/services/mentions", () => ({ syncMentions: vi.fn() }));
vi.mock("@/lib/services/people", () => ({ listMentionCandidates: vi.fn(async () => []) }));

import { parseTaskCapture } from "@/lib/ai/parser";
import { listDomains } from "@/lib/services/domains";
import { syncMentions } from "@/lib/services/mentions";
import { listMentionCandidates } from "@/lib/services/people";
import { listProjects } from "@/lib/services/projects";
import { createTask } from "@/lib/services/tasks";

const sb = {} as SupabaseClient;

beforeEach(() => {
	vi.clearAllMocks();
	(listDomains as Mock).mockResolvedValue([]);
	(listProjects as Mock).mockResolvedValue([]);
	(listMentionCandidates as Mock).mockResolvedValue([]);
});

describe("quickAddTask", () => {
	it("creates the routed, parsed task when parsing succeeds", async () => {
		(listDomains as Mock).mockResolvedValue([{ id: "dom-home", name: "Casa", active: true }]);
		(parseTaskCapture as Mock).mockResolvedValue({
			ok: true,
			task: {
				action: "create_task",
				title: "pagar aluguel",
				due_date: "2026-07-27",
				domain: "Casa",
			},
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
		);
	});

	it.each(["unavailable", "failed", "empty"] as const)(
		"falls back to a raw-title Inbox task when the parser reports %s",
		async (reason) => {
			(parseTaskCapture as Mock).mockResolvedValue({ ok: false, reason, raw: "call the dentist" });
			(createTask as Mock).mockResolvedValue({ id: "task-2" });

			const result = await quickAddTask(sb, "  call the dentist  ");

			expect(result).toEqual({ task: { id: "task-2" }, parsed: false });
			expect(createTask).toHaveBeenCalledWith(sb, {
				title: "call the dentist",
				source: "manual",
			});
		},
	);

	it("propagates a createTask rejection", async () => {
		(parseTaskCapture as Mock).mockResolvedValue({ ok: false, reason: "unavailable", raw: "x" });
		(createTask as Mock).mockRejectedValue(new Error("db down"));

		await expect(quickAddTask(sb, "x")).rejects.toThrow("db down");
	});

	it("appends unresolved routing mentions to notes", async () => {
		(parseTaskCapture as Mock).mockResolvedValue({
			ok: true,
			task: { action: "create_task", title: "ship it", project: "Ghost project" },
		});
		(createTask as Mock).mockResolvedValue({ id: "task-3" });

		await quickAddTask(sb, "ship it for Ghost project");

		expect(createTask).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({
				domain_id: null,
				project_id: null,
				notes: '[capture: unresolved project "Ghost project"]',
			}),
		);
	});

	it("never lets a mention-sync failure fail the capture (iron rule #4)", async () => {
		(parseTaskCapture as Mock).mockResolvedValue({
			ok: true,
			task: { action: "create_task", title: "call @Ana" },
		});
		(createTask as Mock).mockResolvedValue({ id: "task-5", title: "call @Ana", notes: null });
		(listMentionCandidates as Mock).mockRejectedValue(new Error("db down"));
		(syncMentions as Mock).mockRejectedValue(new Error("should never be reached"));

		const result = await quickAddTask(sb, "call @Ana");

		expect(result).toEqual({
			task: { id: "task-5", title: "call @Ana", notes: null },
			parsed: true,
		});
	});

	it("still parses (unrouted) when the routing-list fetch throws — guarded", async () => {
		(listDomains as Mock).mockRejectedValue(new Error("db down"));
		(parseTaskCapture as Mock).mockResolvedValue({
			ok: true,
			task: { action: "create_task", title: "ship it" },
		});
		(createTask as Mock).mockResolvedValue({ id: "task-4" });

		const result = await quickAddTask(sb, "ship it");

		expect(result).toEqual({ task: { id: "task-4" }, parsed: true });
		expect(createTask).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({ domain_id: null, project_id: null }),
		);
	});
});
