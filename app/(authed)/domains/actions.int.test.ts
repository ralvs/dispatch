import { describe, expect, it, vi } from "vitest";
import {
	archiveProjectAction,
	completeProjectAction,
	updateProjectAction,
} from "@/app/(authed)/projects/[id]/actions";
import { createProjectAction } from "@/app/(authed)/projects/actions";
import { ownerClient } from "@/test/integration/clients";
import {
	archiveDomainAction,
	createDomainAction,
	markDomainShippedAction,
	reactivateDomainAction,
	updateDomainAction,
} from "./actions";

// What the domain and project actions write and return, against the real
// tables: the entity store confirms from the returned rows (#30). A domain
// comes back as /domains shows it — with its cadence rule and last touch.
vi.mock("@/lib/auth", () => ({
	requireOwnerPage: async () => ({ sb: await ownerClient() }),
}));
vi.mock("@/lib/mutation-feedback/invalidate", () => ({ afterMutation: vi.fn() }));

function form(entries: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(entries)) fd.set(k, v);
	return fd;
}

async function newDomain(name: string) {
	const result = await createDomainAction(form({ name }));
	if (!result.ok) throw new Error("create failed");
	return result.data.rows[0];
}

describe("domain actions against the local database", () => {
	it("create returns the item, with a touch: a new active domain was never touched", async () => {
		const home = await newDomain("Home");
		expect(home).toMatchObject({ name: "Home", active: true, cadenceDays: null });
		expect(home.touch).toMatchObject({ domainId: home.id, daysSinceTouch: null, openTasks: 0 });
	});

	it("an edit sets the cadence rule, and the item says so", async () => {
		const home = await newDomain("Home");
		const result = await updateDomainAction(home.id, form({ name: "House", cadence_days: "7" }));
		expect(result).toMatchObject({
			ok: true,
			data: { rows: [{ name: "House", cadenceDays: 7, touch: { thresholdDays: 7 } }] },
		});
	});

	it("a bad cadence changes nothing", async () => {
		const home = await newDomain("Home");
		await expect(
			updateDomainAction(home.id, form({ name: "Renamed", cadence_days: "0" })),
		).rejects.toThrow();
		const again = await reactivateDomainAction(home.id);
		expect(again).toMatchObject({ ok: true, data: { rows: [{ name: "Home" }] } });
	});

	it("archive drops the touch; reactivate brings it back; shipping is a touch", async () => {
		const home = await newDomain("Home");
		expect(await archiveDomainAction(home.id)).toMatchObject({
			data: { rows: [{ active: false, touch: null }] },
		});
		expect(await reactivateDomainAction(home.id)).toMatchObject({
			data: { rows: [{ active: true, touch: { domainId: home.id } }] },
		});
		const shipped = await markDomainShippedAction(home.id);
		if (!shipped.ok) throw new Error("ship failed");
		expect(shipped.data.rows[0].last_shipped_at).not.toBeNull();
		expect(shipped.data.rows[0].touch).toMatchObject({ daysSinceTouch: 0 });
	});
});

describe("project actions against the local database", () => {
	it("create, edit, complete and archive each return the project with its domain", async () => {
		const home = await newDomain("Home");
		const created = await createProjectAction(form({ name: "Garden", domain_id: home.id }));
		if (!created.ok) throw new Error("create failed");
		const garden = created.data.rows[0];
		expect(garden).toMatchObject({ name: "Garden", status: "active", domain: { name: "Home" } });

		expect(await updateProjectAction(garden.id, form({ name: "Backyard" }))).toMatchObject({
			data: { rows: [{ name: "Backyard", domain: { name: "Home" } }] },
		});
		const done = await completeProjectAction(garden.id);
		if (!done.ok) throw new Error("complete failed");
		expect(done.data.rows[0]).toMatchObject({ status: "done" });
		expect(done.data.rows[0].completed_at).not.toBeNull();
		expect(await archiveProjectAction(garden.id)).toMatchObject({
			data: { rows: [{ status: "archived" }] },
		});
	});

	it("a project without a domain is a field error", async () => {
		expect(await createProjectAction(form({ name: "Nowhere" }))).toMatchObject({
			ok: false,
			fieldErrors: { domain_id: ["Pick a domain."] },
		});
	});
});
