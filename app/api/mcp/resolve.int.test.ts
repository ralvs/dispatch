import { describe, expect, it } from "vitest";
import { listDomains } from "@/lib/services/domains";
import { createProject } from "@/lib/services/projects";
import { ownerClient } from "@/test/integration/clients";
import { ToolError } from "./contract";
import { resolveDomain, resolveProject, UNFILED } from "./resolve";

describe("resolveProject / resolveDomain", () => {
	it("accepts an id or a case-insensitive name, and inbox as unfiled", async () => {
		const sb = await ownerClient();
		const [domain] = await listDomains(sb);
		const project = await createProject(sb, { name: "Roof Fix", domain_id: domain.id });
		expect((await resolveProject(sb, "roof fix")).id).toBe(project.id);
		expect((await resolveProject(sb, project.id)).name).toBe("Roof Fix");
		expect((await resolveDomain(sb, domain.name.toUpperCase())).valueOf()).toMatchObject({
			id: domain.id,
		});
		expect(await resolveDomain(sb, "Inbox")).toBe(UNFILED);
	});

	it("names the valid choices when nothing matches", async () => {
		const sb = await ownerClient();
		const [domain] = await listDomains(sb);
		await expect(resolveDomain(sb, "nowhere")).rejects.toThrow(ToolError);
		await expect(resolveDomain(sb, "nowhere")).rejects.toThrow(domain.name);
	});
});
