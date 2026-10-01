import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

// The AI gateway is faked: never a paid call.
vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@/lib/ai/gateway", () => ({
	isAiConfigured: vi.fn(() => true),
	parserModel: vi.fn(() => ({})),
	MODEL_PROVIDER_OPTIONS: { anthropic: { effort: "low" } },
}));

import { generateObject } from "ai";
import { isAiConfigured } from "@/lib/ai/gateway";
import { quickAddTask } from "@/lib/services/capture/quick-add";
import { type DomainRow, listDomains } from "@/lib/services/domains";
import { createProject } from "@/lib/services/projects";
import { ownerClient, unreachableClient } from "@/test/integration/clients";

type Sb = Awaited<ReturnType<typeof ownerClient>>;

let sb: Sb;
let home: DomainRow;
let work: DomainRow;

beforeEach(async () => {
	vi.mocked(generateObject).mockReset();
	(isAiConfigured as Mock).mockReturnValue(true);
	sb = await ownerClient();
	[home, work] = await listDomains(sb);
});

function parsedTask(task: Record<string, unknown> | null) {
	(generateObject as Mock).mockResolvedValue({ object: { task } });
}

async function row(id: string) {
	const { data } = await sb
		.from("tasks")
		.select("title, due_date, domain_id, project_id, notes, source")
		.eq("id", id)
		.single();
	return data;
}

describe("quickAddTask", () => {
	it("creates the routed, parsed task when parsing succeeds", async () => {
		parsedTask({
			action: "create_task",
			title: "pagar aluguel",
			due_date: "2026-07-27",
			domain: home.name,
		});

		const result = await quickAddTask(sb, `pagar aluguel toda segunda em ${home.name}`);

		expect(result.parsed).toBe(true);
		expect(await row(result.task.id)).toEqual({
			title: "pagar aluguel",
			due_date: "2026-07-27",
			domain_id: home.id,
			project_id: null,
			notes: null,
			source: "manual",
		});
	});

	// Stated beats inferred: the form's domain field is mandatory, its parsing is not.
	it("lets a stated domain override the one the parser inferred", async () => {
		parsedTask({ action: "create_task", title: "pagar aluguel", domain: home.name });

		const { task } = await quickAddTask(sb, "pagar aluguel", { domainId: work.id });

		expect((await row(task.id))?.domain_id).toBe(work.id);
	});

	describe("when a stated domain disagrees with the parsed project", () => {
		it("drops the project rather than filing it under the wrong domain", async () => {
			await createProject(sb, { name: "Dispatch", domain_id: work.id });
			parsedTask({ action: "create_task", title: "changelog", project: "Dispatch" });

			const { task } = await quickAddTask(sb, "add a changelog page to Dispatch", {
				domainId: home.id,
			});

			expect(await row(task.id)).toMatchObject({ domain_id: home.id, project_id: null });
		});

		it("keeps the project when the stated domain is its own", async () => {
			const project = await createProject(sb, { name: "Dispatch", domain_id: work.id });
			parsedTask({ action: "create_task", title: "changelog", project: "Dispatch" });

			const { task } = await quickAddTask(sb, "add a changelog page to Dispatch", {
				domainId: work.id,
			});

			expect(await row(task.id)).toMatchObject({ domain_id: work.id, project_id: project.id });
		});
	});

	it("files a stated domain even when the parse degrades", async () => {
		(isAiConfigured as Mock).mockReturnValue(false);

		const { task, parsed } = await quickAddTask(sb, "pagar aluguel", { domainId: work.id });

		expect(parsed).toBe(false);
		expect(await row(task.id)).toMatchObject({ title: "pagar aluguel", domain_id: work.id });
	});

	it.each(["unavailable", "failed", "empty"] as const)(
		"falls back to a raw-title unfiled task when the parser reports %s",
		async (reason) => {
			if (reason === "unavailable") (isAiConfigured as Mock).mockReturnValue(false);
			else if (reason === "failed") (generateObject as Mock).mockRejectedValue(new Error("boom"));
			else parsedTask(null);

			const result = await quickAddTask(sb, "  call the dentist  ");

			expect(result.parsed).toBe(false);
			expect(await row(result.task.id)).toMatchObject({
				title: "call the dentist",
				domain_id: null,
				source: "manual",
			});
		},
	);

	it("propagates a failed task write", async () => {
		(isAiConfigured as Mock).mockReturnValue(false);

		await expect(quickAddTask(unreachableClient(), "x")).rejects.toThrow();
	});

	it("appends unresolved routing mentions to notes", async () => {
		parsedTask({ action: "create_task", title: "ship it", project: "Ghost project" });

		const { task } = await quickAddTask(sb, "ship it for Ghost project");

		expect(await row(task.id)).toMatchObject({
			domain_id: null,
			project_id: null,
			notes: '[capture: unresolved project "Ghost project"]',
		});
	});

	it("writes the mention for an @Name in the parsed title", async () => {
		const { data: ana } = await sb.from("people").insert({ name: "Ana" }).select("id").single();
		parsedTask({ action: "create_task", title: "call @Ana" });

		const { task } = await quickAddTask(sb, "call @Ana");

		const { data } = await sb.from("mentions").select("person_id").eq("task_id", task.id);
		expect(data).toEqual([{ person_id: ana?.id }]);
	});
});
