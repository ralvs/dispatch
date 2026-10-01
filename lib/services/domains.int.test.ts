import { describe, expect, it } from "vitest";
import {
	archiveDomain,
	createDomain,
	getDomain,
	listDomains,
	markDomainShipped,
	updateDomain,
} from "@/lib/services/domains";
import { ownerClient } from "@/test/integration/clients";

// These writers write straight through: the system Inbox domain they used to
// refuse no longer exists (docs/adr/0027).
describe("domains against the local database", () => {
	it("creates and renames a domain", async () => {
		const sb = await ownerClient();
		const domain = await createDomain(sb, { name: "Gardening" });
		expect(await getDomain(sb, domain.id)).toMatchObject({ name: "Gardening", active: true });

		await updateDomain(sb, domain.id, { name: "Gardening & Tools" });
		expect((await getDomain(sb, domain.id))?.name).toBe("Gardening & Tools");
	});

	it("archiving drops a domain from the active list only", async () => {
		const sb = await ownerClient();
		const domain = await createDomain(sb, { name: "Archive me" });

		await archiveDomain(sb, domain.id);

		expect((await getDomain(sb, domain.id))?.active).toBe(false);
		expect((await listDomains(sb)).map((d) => d.id)).not.toContain(domain.id);
		const all = await listDomains(sb, { includeArchived: true });
		expect(all.map((d) => d.id)).toContain(domain.id);
	});

	it("stamps last_shipped_at", async () => {
		const sb = await ownerClient();
		const domain = await createDomain(sb, { name: "Ship" });

		await markDomainShipped(sb, domain.id);

		expect((await getDomain(sb, domain.id))?.last_shipped_at).not.toBeNull();
	});
});
