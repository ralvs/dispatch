import { describe, expect, it } from "vitest";
import { applyIntent, applySeed, confirmWrite, initialState, selectView } from "@/lib/store/core";
import { viewKey } from "@/lib/store/keys";
import { domainItem, NOW, project, snapshot, T1, T2, task } from "@/lib/store/test-fixtures";

const ids = (rows: { id: string }[] | undefined) => rows?.map((r) => r.id);

describe("project kind", () => {
	const alpha = project({ id: "alpha", name: "Alpha" });
	const gamma = project({ id: "gamma", name: "Gamma" });
	const seeded = () =>
		applySeed(
			initialState(),
			snapshot(T1, [
				{ key: viewKey.projects(), type: "projectList", data: { rows: [alpha, gamma] } },
				{
					key: viewKey.projectHead("alpha"),
					type: "projectList",
					data: { rows: [alpha], scope: { id: "alpha" } },
				},
			]),
		);

	it("a new project takes its place by name, and stays off another project's page", () => {
		const [s1] = applyIntent(
			seeded(),
			{ kind: "project", intent: { type: "create", row: project({ id: "tmp", name: "Beta" }) } },
			NOW,
		);
		expect(ids(selectView(s1, viewKey.projects()))).toEqual(["alpha", "tmp", "gamma"]);
		expect(ids(selectView(s1, viewKey.projectHead("alpha")))).toEqual(["alpha"]);
	});

	it("marking a project done on its page moves it on /projects", () => {
		const [s1, t] = applyIntent(
			seeded(),
			{ kind: "project", intent: { type: "patch", id: "alpha", patch: { status: "done" } } },
			NOW,
		);
		expect(selectView(s1, viewKey.projects())?.find((p) => p.id === "alpha")?.status).toBe("done");
		const s2 = confirmWrite(s1, t, { at: T2, rows: [{ ...alpha, status: "done" }] });
		expect(selectView(s2, viewKey.projectHead("alpha"))?.[0].status).toBe("done");
	});

	it("a row's task view admits a task added to that project, and no other", () => {
		const s0 = applySeed(
			initialState(),
			snapshot(T1, [
				{
					key: viewKey.projectRowTasks("alpha"),
					type: "taskList",
					data: { rows: [], scope: { projectId: "alpha" } },
				},
			]),
		);
		let s = s0;
		for (const t of [
			task({ id: "mine", project_id: "alpha" }),
			task({ id: "theirs", project_id: "gamma" }),
		]) {
			[s] = applyIntent(s, { kind: "task", intent: { type: "create", task: t } }, NOW);
		}
		expect(ids(selectView(s, viewKey.projectRowTasks("alpha")))).toEqual(["mine"]);
	});
});

describe("domain kind", () => {
	it("active first, then by name; archiving moves a domain below the active ones", () => {
		const s0 = applySeed(
			initialState(),
			snapshot(T1, [
				{
					key: viewKey.domains(),
					type: "domainList",
					data: {
						rows: [
							domainItem({ id: "health", name: "Health" }),
							domainItem({ id: "work", name: "Work" }),
							domainItem({ id: "old", name: "Archive me", active: false }),
						],
					},
				},
			]),
		);
		const [s1] = applyIntent(
			s0,
			{ kind: "domain", intent: { type: "patch", id: "health", patch: { active: false } } },
			NOW,
		);
		expect(ids(selectView(s1, viewKey.domains()))).toEqual(["work", "old", "health"]);
		const [s2, t] = applyIntent(
			s0,
			{ kind: "domain", intent: { type: "patch", id: "health", patch: { active: false } } },
			NOW,
		);
		const s3 = confirmWrite(s2, t, {
			at: T2,
			rows: [domainItem({ id: "health", name: "Health", active: false })],
		});
		expect(ids(selectView(s3, viewKey.domains()))).toEqual(["work", "old", "health"]);
	});
});
