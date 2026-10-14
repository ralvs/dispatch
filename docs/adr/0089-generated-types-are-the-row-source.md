# Generated types are the row source

Date: 2026-10-13

The Supabase client was untyped. Row shapes came from Zod `*RowSchema`
objects, selects were built with `Object.keys(...)` and typed as `string`, and
about 58 `as unknown as` casts bridged the gap. Nothing tied those shapes to
the database, so drift went unnoticed: `person_interactions.occurred_at` is
NOT NULL with a default, yet the service could send `null`, and
`quote_annotations.context` is nullable in the database but not in Zod. The
checked-in `lib/database.types.ts` was itself stale, missing five RPCs and a
foreign key.

## Decision

1. **One client type.** `lib/supabase/types.ts` exports
   `SupabaseClient = SupabaseClient<Database>`. Every client creator passes
   `<Database>`. Nothing else imports `SupabaseClient` from
   `@supabase/supabase-js`.
2. **`lib/database.types.ts` is generated, never edited.** `bun run db:types`
   writes it from the local stack, formatted by Biome. Run it after every
   migration, with the stack at that migration (`supabase db reset`).
3. **`lib/database.ts` holds every override** of what the generator emits:
   - column narrowing through `Narrow<T, C>`, which rejects unknown columns;
   - RPC nullability through `NullableArgs`, because the generator types every
     argument and return as non-null;
   - `__InternalSupabase`, which local generation omits.
   It exports `Database`, `TableName` and `Selected<T, Q>`.
4. **Row types come from the select.** A literal `*_SELECT` string `as const`
   and `Selected<"table", typeof X_SELECT>` sit together. A bad column makes
   the row `never`. Zod stays for input and enums only.
5. **`unwrap` keeps the result type.** `unwrap<R>(r): Ok<R>`, so `.single()`
   stays non-null and a select's row type flows through.

## Rules

- No `as unknown as` on a query result.
- A new RPC with a nullable argument or return gets a `NullableArgs` entry.
- A column narrower than its generated type gets a `Narrow` entry.

## Enforcement

- Biome `noRestrictedImports` on `SupabaseClient` from `@supabase/supabase-js`.
- The E2E job regenerates the types and diffs them against the file.
- `tsc` over services, actions and integration tests.

## Consequences

- Database drift fails at compile time, not in production.
- `Selected` builds on postgrest-js's `UnstableGetResult`. `@supabase/supabase-js`
  stays pinned exactly; a bump may need a fix in `lib/database.ts`.
- The Supabase CLI version must match in CI and locally, or the drift step
  reports false diffs.
- `Narrow` checks that a column exists, not that its type still matches.
- Amends ADR-0078: `TABLE_WRITERS` is keyed by `TableName`.
- The row-schema removal and the remaining casts are migrated slice by slice.
