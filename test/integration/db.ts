import postgres from "postgres";
import { inject } from "vitest";

type Sql = postgres.Sql;

/**
 * Isolation between tests: reset, not transactions (docs/adr/0063).
 *
 * Services talk to PostgREST over HTTP, one request per query, so a test cannot
 * be wrapped in a transaction that rolls back. Instead every public table is
 * truncated before each test and refilled from `test_baseline` — a copy of the
 * public schema's rows taken right after the migrations ran, so the rows the
 * migrations seed (domains, app_settings, the welcome note) survive.
 *
 * Triggers and FK checks are off while it runs (`session_replication_role`),
 * so table order does not matter. auth.* is untouched: the seeded owner stays.
 */

const BASELINE = "test_baseline";

async function latestMigration(sql: Sql): Promise<string> {
	const [row] = await sql<{ version: string }[]>`
		select max(version) as version from supabase_migrations.schema_migrations`;
	return row.version;
}

/**
 * Take the baseline on the first run against a fresh stack. If migrations
 * moved since, the baseline no longer matches the schema, and the tables may
 * already hold test rows — only a `supabase db reset` gets back to clean.
 */
export async function ensureBaseline(sql: Sql): Promise<void> {
	const version = await latestMigration(sql);
	const [schema] = await sql`
		select 1 from information_schema.schemata where schema_name = ${BASELINE}`;

	if (schema) {
		const [meta] = await sql<{ version: string }[]>`select version from ${sql(BASELINE)}._meta`;
		if (meta?.version !== version) {
			throw new Error(
				`The test baseline was taken at migration ${meta?.version ?? "(unknown)"}, the database is at ${version}. Run \`supabase db reset\`.`,
			);
		}
		return;
	}

	await sql.begin(async (tx) => {
		await tx`create schema ${tx(BASELINE)}`;
		for (const table of await publicTables(tx)) {
			await tx`create table ${tx(BASELINE)}.${tx(table)} as table public.${tx(table)}`;
		}
		await tx`create table ${tx(BASELINE)}._meta (version text not null)`;
		await tx`insert into ${tx(BASELINE)}._meta (version) values (${version})`;
	});
}

async function publicTables(sql: postgres.TransactionSql | Sql): Promise<string[]> {
	const rows = await sql<{ table_name: string }[]>`
		select table_name from information_schema.tables
		where table_schema = 'public' and table_type = 'BASE TABLE'
		order by table_name`;
	return rows.map((row) => row.table_name);
}

let client: Sql | undefined;

function db(): Sql {
	client ??= postgres(inject("supabase").dbUrl, { max: 1, onnotice: () => {} });
	return client;
}

export async function resetDatabase(): Promise<void> {
	await db().begin(async (tx) => {
		await tx`set local session_replication_role = replica`;
		const tables = await publicTables(tx);
		await tx`truncate table ${tx(tables.map((t) => `public.${t}`))} restart identity`;
		for (const table of tables) {
			await tx`insert into public.${tx(table)} select * from ${tx(BASELINE)}.${tx(table)}`;
		}
	});
}

export async function closeDatabase(): Promise<void> {
	await client?.end();
	client = undefined;
}
