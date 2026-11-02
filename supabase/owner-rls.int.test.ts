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

/** Every public table, with one column to filter on. Service-only tables
 * (RLS on, no policy) are in the list too. */
async function publicTables(): Promise<{ table: string; column: string }[]> {
	return sql<{ table: string; column: string }[]>`
		select distinct on (c.table_name) c.table_name as table, c.column_name as column
		from information_schema.columns c
		join information_schema.tables t
			on t.table_schema = c.table_schema and t.table_name = c.table_name
		where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
		order by c.table_name, c.ordinal_position`;
}

/** A fingerprint of every row, read past RLS. */
async function contents(table: string): Promise<string> {
	const [row] = await sql<{ digest: string }[]>`
		select md5(coalesce(string_agg(t::text, ',' order by t::text), '')) as digest
		from ${sql(`public.${table}`)} t`;
	return row.digest;
}

describe("owner-scoped RLS", () => {
	it("every policy a signed-in role can use checks the owner", async () => {
		// Both expressions null is a policy that lets everything through.
		const open = await sql<{ table: string; policy: string }[]>`
			select schemaname || '.' || tablename as table, policyname as policy
			from pg_policies
			where schemaname in ('public', 'storage')
				and ('authenticated' = any (roles) or 'anon' = any (roles) or 'public' = any (roles))
				and (
					(qual is null and with_check is null)
					or (qual is not null and qual not like '%private.is_owner()%')
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
		const tables = await publicTables();
		expect(tables.length).toBeGreaterThan(0);

		// The migrations seed app_settings, the domains and a welcome note, so
		// some of these tables hold rows the owner sees.
		let ownerRows = 0;
		for (const { table } of tables) {
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
		for (const { table, column } of await publicTables()) {
			const before = await contents(table);

			const insert = await from(stranger, table).insert({} as never);
			expect(insert.error?.code, table).toBe("42501");

			// Update and delete see no rows, so they change none.
			const update = await from(stranger, table)
				.update({ [column]: null } as never)
				.not(column, "is", null)
				.select();
			expect(update.data ?? [], table).toEqual([]);
			const remove = await from(stranger, table).delete().not(column, "is", null).select();
			expect(remove.data ?? [], table).toEqual([]);

			expect(await contents(table), table).toBe(before);
		}
	});

	it("a stranger cannot read or write the media bucket", async () => {
		const [owner, stranger] = await Promise.all([ownerClient(), strangerClient()]);
		const path = `owner-rls/${crypto.randomUUID()}.txt`;

		const upload = await owner.storage.from("media").upload(path, new Blob(["owner only"]));
		expect(upload.error).toBeNull();
		try {
			const download = await stranger.storage.from("media").download(path);
			expect(download.error).not.toBeNull();
			expect(download.data).toBeNull();

			const list = await stranger.storage.from("media").list("owner-rls");
			expect(list.error).toBeNull();
			expect(list.data).toEqual([]);

			const theirs = await stranger.storage
				.from("media")
				.upload(`owner-rls/${crypto.randomUUID()}.txt`, new Blob(["stranger"]));
			expect(theirs.error?.message).toMatch(/row-level security/);

			await stranger.storage.from("media").remove([path]);
			const still = await owner.storage.from("media").download(path);
			expect(still.error).toBeNull();
		} finally {
			await serviceClient().storage.from("media").remove([path]);
		}
	});
});
