import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

// Stubbed services, for the two seams below that a real database cannot
// produce on cue. The database-backed cases live in quick-add.int.test.ts.
vi.mock("@/lib/services/domains", () => ({ listDomains: vi.fn(async () => []) }));
vi.mock("@/lib/services/projects", () => ({ listProjects: vi.fn(async () => []) }));
vi.mock("@/lib/services/settings", () => ({
	getAppTimezone: vi.fn(async () => "America/Sao_Paulo"),
}));
vi.mock("@/lib/services/tasks", () => ({ createTask: vi.fn(async () => ({ id: "task-1" })) }));

import type { SupabaseClient } from "@supabase/supabase-js";
import { quickAddTask } from "@/lib/services/capture/quick-add";
import { listDomains } from "@/lib/services/domains";
import { createTask } from "@/lib/services/tasks";
import { fakeParserModel } from "@/test/fakes/parser-model";

beforeEach(() => {
	vi.clearAllMocks();
});

function parsedTask(task: Record<string, unknown>) {
	return { model: fakeParserModel({ task }) };
}

describe("quickAddTask · fault seams", () => {
	const sb = {} as SupabaseClient;

	// Iron rule #4: a mention-graph failure must never drop the task.
	it("passes graphFail swallow into createTask", async () => {
		await quickAddTask(sb, "call @Ana", parsedTask({ action: "create_task", title: "call @Ana" }));

		expect(createTask).toHaveBeenCalledWith(sb, expect.objectContaining({ title: "call @Ana" }), {
			graphFail: "swallow",
		});
	});

	it("still parses, unrouted, when the routing-list fetch throws", async () => {
		(listDomains as Mock).mockRejectedValueOnce(new Error("db down"));
		const result = await quickAddTask(
			sb,
			"ship it",
			parsedTask({ action: "create_task", title: "ship it" }),
		);

		expect(result.parsed).toBe(true);
		expect(createTask).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({ domain_id: null, project_id: null }),
			{ graphFail: "swallow" },
		);
	});
});
