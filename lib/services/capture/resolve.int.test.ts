import { describe, expect, it } from "vitest";
import { fetchRoutingLists, loadCaptureContext } from "@/lib/services/capture/resolve";
import { listDomains } from "@/lib/services/domains";
import { createProject, updateProject } from "@/lib/services/projects";
import { serviceClient, unreachableClient } from "@/test/integration/clients";

describe("fetchRoutingLists", () => {
	it("maps domains down to id/name and keeps only active projects", async () => {
		const sb = serviceClient();
		const domains = await listDomains(sb);
		const home = domains[0];
		const reviews = await createProject(sb, { name: "Reviews", domain_id: home.id });
		const paused = await createProject(sb, { name: "Paused", domain_id: home.id });
		await updateProject(sb, paused.id, { status: "paused" });

		const result = await fetchRoutingLists(sb);

		expect(result.domains).toEqual(domains.map((d) => ({ id: d.id, name: d.name })));
		expect(result.projects).toEqual([{ id: reviews.id, name: "Reviews", domain_id: home.id }]);
	});

	it("degrades to empty lists when the fetch fails", async () => {
		expect(await fetchRoutingLists(unreachableClient())).toEqual({ domains: [], projects: [] });
	});
});

describe("loadCaptureContext", () => {
	it("loads the app timezone and pairs each project with its domain's name", async () => {
		const sb = serviceClient();
		const [home] = await listDomains(sb);
		await createProject(sb, { name: "Apartment move", domain_id: home.id });

		const result = await loadCaptureContext(sb);

		expect(result.tz).toBe("America/Sao_Paulo");
		expect(result.ctx.tz).toBe("America/Sao_Paulo");
		expect(result.ctx.domains).toContain(home.name);
		expect(result.ctx.projects).toEqual([{ name: "Apartment move", domain: home.name }]);
	});
});
