import postgres from "postgres";
import { afterAll, describe, expect, inject, it } from "vitest";
import type { Database } from "@/lib/database";
import type { SupabaseClient } from "@/lib/supabase/types";
import { ownerClient, serviceClient, strangerClient } from "@/test/integration/clients";

// RLS lets the owner in and no one else (docs/adr/0095, #164). The stranger is
// a real signed-in account, so these are the reads and writes anyone would get
// through PostgREST and Storage if hosted sign-ups were ever on.

const sql = postgres(inject("supabase").dbUrl, { max: 1, onnotice: () => {} });

afterAll(async () => {
	await sql.end();
});

type Table = keyof Database["public"]["Tables"];

// The table name comes from the catalog, so the row type is unknown here.
function from(sb: SupabaseClient, table: string) {
	return sb.from(table as Table);
}

async function policyTables(): Promise<string[]> {
	const rows = await sql<{ tablename: string }[]>`
		select distinct tablename from pg_policies
		where schemaname = 'public' order by tablename`;
	return rows.map((row) => row.tablename);
}

describe("owner-scoped RLS", () => {
	it("every policy a signed-in role can use checks the owner", async () => {
		const open = await sql<{ table: string; policy: string }[]>`
			select schemaname || '.' || tablename as table, policyname as policy
			from pg_policies
			where schemaname in ('public', 'storage')
				and ('authenticated' = any (roles) or 'anon' = any (roles) or 'public' = any (roles))
				and (
					(qual is not null and qual not like '%private.is_owner()%')
					or (with_check is not null and with_check not like '%private.is_owner()%')
				)`;
		expect(open).toEqual([]);
	});

	it("every public table has RLS on", async () => {
		const unguarded = await sql<{ table_name: string }[]>`
			select c.relname as table_name from pg_class c
			join pg_namespace n on n.oid = c.relnamespace
			where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`;
		expect(unguarded).toEqual([]);
	});

	it("a stranger reads no row the owner can see", async () => {
		const [owner, stranger] = await Promise.all([ownerClient(), strangerClient()]);
		const tables = await policyTables();
		expect(tables.length).toBeGreaterThan(0);

		// The migrations seed app_settings, the domains and a welcome note, so
		// some of these tables hold rows the owner sees.
		let ownerRows = 0;
		for (const table of tables) {
			const mine = await from(owner, table).select("*");
			expect(mine.error, table).toBeNull();
			ownerRows += mine.data?.length ?? 0;

			const theirs = await from(stranger, table).select("*");
			expect(theirs.error, table).toBeNull();
			expect(theirs.data, table).toEqual([]);
		}
		expect(ownerRows).toBeGreaterThan(0);
	});

	it("a stranger cannot insert, update or delete", async () => {
		const stranger = await strangerClient();
		for (const table of await policyTables()) {
			const insert = await from(stranger, table).insert({} as never);
			expect(insert.error?.code, table).toBe("42501");
		}

		// Update and delete see no rows, so they change none.
		const before = await serviceClient().from("app_settings").select("*");
		const update = await stranger
			.from("app_settings")
			.update({ timezone: "UTC" })
			.not("timezone", "is", null)
			.select();
		expect(update.data).toEqual([]);
		const remove = await stranger
			.from("stewardship_domains")
			.delete()
			.not("id", "is", null)
			.select();
		expect(remove.data).toEqual([]);

		const after = await serviceClient().from("app_settings").select("*");
		expect(after.data).toEqual(before.data);
		const domains = await serviceClient().from("stewardship_domains").select("id");
		expect(domains.data?.length).toBeGreaterThan(0);
	});

	it("a stranger cannot read or write the media bucket", async () => {
		const [owner, stranger] = await Promise.all([ownerClient(), strangerClient()]);
		const path = `owner-rls/${crypto.randomUUID()}.txt`;

		const upload = await owner.storage.from("media").upload(path, new Blob(["owner only"]));
		expect(upload.error).toBeNull();
		try {
			const download = await stranger.storage.from("media").download(path);
			expect(download.data).toBeNull();

			const list = await stranger.storage.from("media").list("owner-rls");
			expect(list.data ?? []).toEqual([]);

			const theirs = await stranger.storage
				.from("media")
				.upload(`owner-rls/${crypto.randomUUID()}.txt`, new Blob(["stranger"]));
			expect(theirs.error).not.toBeNull();

			await stranger.storage.from("media").remove([path]);
			const still = await owner.storage.from("media").download(path);
			expect(still.error).toBeNull();
		} finally {
			await serviceClient().storage.from("media").remove([path]);
		}
	});
});
