# RLS lets only the owner in

Date: 2026-11-02

Every public table had one policy, `for all to authenticated using (true)
with check (true)`, and the media bucket the same. `requireOwner()`
(ADR-0003) guards the app's routes, but a direct PostgREST or Storage call
with any signed-in account's own JWT skipped it. The one thing keeping a
stranger out was the hosted **sign-ups off** switch, on the same
Authentication screens the MCP work (ADR-0079) keeps changing. Nothing in the
repo held it (#89, side finding in run 3; #164).

## Amends

- ADR-0003: the owner check also lives in the database.
- ADR-0041, rule 2: mirrors the sentence added there.

## Decision

1. **The owner's id lives in `private.owner`**, a one-row table in a schema
   the Data API does not expose. `authenticated` cannot read or write it.
2. **`private.is_owner()`** (security definer, `search_path = ''`) is true
   when `auth.uid()` is that id. An empty table means nobody is the owner.
3. **Every policy a signed-in role can use checks it.** Each
   `<table>_authenticated_all` became `<table>_owner_all`, `using` and
   `with check` both `(select private.is_owner())`. The four media policies
   add the same check to `bucket_id = 'media'`. Tables with RLS on and no
   policy stay service-role only.
4. **The migration takes the owner from `auth.users`** instead of writing the
   hosted id into a public repo: the hosted project had one account, the
   owner's (checked 2026-11-02). It stops with an error if it finds more than
   one. A fresh local stack has none when migrations run, so
   `supabase/seed.sql` sets the local owner.
5. **A test holds the rule.** `supabase/owner-rls.int.test.ts` fails if any
   public or storage policy for a signed-in role leaves out
   `private.is_owner()`, if a public table has RLS off, or if a second,
   non-owner account (`strangerClient()`) reads a row, writes a row, or
   touches the media bucket.

## Not chosen

- **A scheduled check that hosted sign-ups are off** (#164 option B). It needs
  a Management API token as a repo secret, and it only warns after the fact.
  With RLS scoped, an account that gets in sees nothing.

## Consequences

- The owner is named in two places: `OWNER_USER_ID` (the app's guard) and
  `private.owner` (RLS). If they disagree the app lets you in and every query
  returns nothing. Changing the owner means updating both.
- A new table's policy must use `(select private.is_owner())`. Copying an old
  `using (true)` policy fails the integration test.
- Service-role callers (crons, `/api/capture`, the admin client) bypass RLS
  as before and keep their own guards (ADR-0003, ADR-0031). The MCP bearer
  path runs as the owner's token, so `auth.uid()` is the owner.
- The `(select …)` wrapper lets Postgres run the check once per query, not
  once per row.
