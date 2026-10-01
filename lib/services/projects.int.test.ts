import { describe, expect, it } from "vitest";
import { listDomains } from "@/lib/services/domains";
import {
	completeProject,
	countTasksByProject,
	createProject,
	getProject,
	updateProject,
} from "@/lib/services/projects";
import { completeTask, createTask } from "@/lib/services/tasks";
import { ownerClient } from "@/test/integration/clients";

async function aDomainId(sb: Awaited<ReturnType<typeof ownerClient>>) {
	return (await listDomains(sb))[0].id;
}

describe("projects against the local database", () => {
	it("stores the given fields", async () => {
		const sb = await ownerClient();
		const domain_id = await aDomainId(sb);
		const project = await createProject(sb, { name: "Rebuild deck", domain_id });

		expect(await getProject(sb, project.id)).toMatchObject({
			name: "Rebuild deck",
			domain_id,
			status: "active",
		});
	});

	it("completes a project: status done and completed_at stamped", async () => {
		const sb = await ownerClient();
		const project = await createProject(sb, { name: "Ship", domain_id: await aDomainId(sb) });

		await completeProject(sb, project.id);

		const row = await getProject(sb, project.id);
		expect(row?.status).toBe("done");
		expect(row?.completed_at).not.toBeNull();
	});

	it("counts every task tagged to a project, quiet ones included", async () => {
		const sb = await ownerClient();
		const domain_id = await aDomainId(sb);
		const p1 = await createProject(sb, { name: "P1", domain_id });
		const p2 = await createProject(sb, { name: "P2", domain_id });
		// A paused project's undated task is quiet on Today, not on its own page.
		await updateProject(sb, p1.id, { status: "paused" });

		await createTask(sb, { title: "open", project_id: p1.id, domain_id });
		const done = await createTask(sb, { title: "done", project_id: p1.id, domain_id });
		await completeTask(sb, done.id, "2026-09-22", { dueDate: null });
		await createTask(sb, { title: "other", project_id: p2.id, domain_id });
		await createTask(sb, { title: "loose" });

		const counts = await countTasksByProject(sb);

		expect(counts[p1.id]).toEqual({ done: 1, open: 1 });
		expect(counts[p2.id]).toEqual({ done: 0, open: 1 });
		// A task with no project is not a project's task.
		expect(Object.keys(counts).sort()).toEqual([p1.id, p2.id].sort());
	});
});
