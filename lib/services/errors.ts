// No "server-only" guard here: this module is pure typed-error logic (no
// Supabase client, no env, no I/O) and is unit-tested directly.

/**
 * Typed replacement for the untyped errors Supabase-js throws. Preserves the
 * Postgres/PostgREST error code so callers can still branch on it (e.g.
 * unique-violation `23505`) without depending on the Supabase error shape.
 */
export class ServiceError extends Error {
	code: string | null;
	details?: string;

	constructor(message: string, code: string | null, details?: string) {
		super(message);
		this.name = "ServiceError";
		this.code = code;
		this.details = details;
	}
}

/**
 * An append the database refused before anything was written: the row is
 * gone, or the text would pass its cap. The message says which, as written.
 */
export class AppendRefusedError extends Error {
	override name = "AppendRefusedError";
}

/**
 * An edit that landed in part: its append committed, then a later step
 * failed. The row changed, so a caller that records its writes (iron rule #6)
 * still owes the ledger a row. `cause` is the failure.
 */
export class PartialWriteError extends Error {
	override name = "PartialWriteError";

	constructor(cause: unknown) {
		super(cause instanceof Error ? cause.message : String(cause), { cause });
	}
}

type SupabaseError = { message: string; code?: string; details?: string | null };

type SupabaseResult = { data: unknown; error: SupabaseError | null };

/** The success branch of a Supabase result: `data` with the error case excluded. */
export type Ok<R> = R extends { error: SupabaseError }
	? never
	: R extends { data: infer D }
		? D
		: never;

/**
 * Replaces the copy-pasted `const { data, error } = await …; if (error) throw
 * error;` ritual. Throws a typed ServiceError on failure; otherwise returns
 * `data` as-is.
 *
 * Ergonomic for both call shapes:
 *   - queries: `const rows = unwrap(await sb.from(...).select(...));`
 *   - mutations: `unwrap(await sb.from(...).update(...).eq(...));` (discard
 *     the returned null — the point of the call is the error check)
 */
export function unwrap<R extends SupabaseResult>(result: R): Ok<R> {
	if (result.error) {
		throw new ServiceError(
			result.error.message,
			result.error.code ?? null,
			result.error.details ?? undefined,
		);
	}
	return result.data as Ok<R>;
}

type SupabaseCountResult = {
	count: number | null;
	error: { message: string; code?: string; details?: string | null } | null;
};

/**
 * `unwrap`'s counterpart for `{ count: "exact", head: true }` queries, whose
 * result shape (`{ count, error }`, no `data`) `unwrap` doesn't model. Throws
 * a typed ServiceError on failure; otherwise returns `count`, coalescing the
 * head-query's possible `null` to `0`.
 */
export function unwrapCount(result: SupabaseCountResult): number {
	if (result.error) {
		throw new ServiceError(
			result.error.message,
			result.error.code ?? null,
			result.error.details ?? undefined,
		);
	}
	return result.count ?? 0;
}
