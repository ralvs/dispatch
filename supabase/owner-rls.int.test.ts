import postgres from "postgres";
import { afterAll, describe, expect, inject, it } from "vitest";
import type { Database } from "@/lib/database";
import type { SupabaseClient } from "@/lib/supabase/types";
import { ownerClient, strangerClient } from "@/test/integration/clients";
import { OWNER_USER_ID } from "@/test/integration/stack";

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

	// Straight against storage.objects, as the Storage API would run it: CI
	// starts the stack without storage-api (.github/workflows/e2e.yml).
	it("a stranger cannot read or write the media bucket", async () => {
		const stranger = await strangerClient();
		const { data } = await stranger.auth.getUser();
		const strangerId = data.user?.id;
		expect(strangerId).toBeDefined();
		const name = `owner-rls/${crypto.randomUUID()}.txt`;

		/** One transaction as `userId`, the way PostgREST and Storage set the role. */
		function asUser<T>(userId: string, run: (tx: postgres.TransactionSql) => Promise<T>) {
			return sql.begin(async (tx) => {
				await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
				// Lets a delete reach RLS instead of storage's "use the API" guard.
				await tx`select set_config('storage.allow_delete_query', 'true', true)`;
				await tx`set local role authenticated`;
				return run(tx);
			}) as Promise<T>;
		}
		const count = (tx: postgres.TransactionSql) =>
			tx<{ n: number }[]>`
				select count(*)::int as n from storage.objects
				where bucket_id = 'media' and name = ${name}`.then(([row]) => row.n);

		await sql`insert into storage.objects (bucket_id, name) values ('media', ${name})`;
		try {
			expect(await asUser(OWNER_USER_ID, count)).toBe(1);
			expect(await asUser(strangerId as string, count)).toBe(0);

			const renamed = await asUser(strangerId as string, (tx) =>
				tx`update storage.objects set name = ${`${name}.moved`} where name = ${name}`.then(
					(rows) => rows.count,
				),
			);
			expect(renamed).toBe(0);
			const removed = await asUser(strangerId as string, (tx) =>
				tx`delete from storage.objects where name = ${name}`.then((rows) => rows.count),
			);
			expect(removed).toBe(0);
			expect(await asUser(OWNER_USER_ID, count)).toBe(1);

			await expect(
				asUser(
					strangerId as string,
					(tx) =>
						tx`insert into storage.objects (bucket_id, name) values ('media', ${`${name}.theirs`})`,
				),
			).rejects.toMatchObject({ code: "42501" });
		} finally {
			await sql.begin(async (tx) => {
				await tx`select set_config('storage.allow_delete_query', 'true', true)`;
				await tx`delete from storage.objects where name like ${`${name}%`}`;
			});
		}
	});
});
