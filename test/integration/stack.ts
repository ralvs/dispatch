/**
 * The local Supabase stack the integration layer runs against (docs/adr/0063).
 * `global-setup.ts` reads it from `supabase status` once per run and hands it
 * to the test files through Vitest's provide/inject.
 */
export type LocalStack = {
	apiUrl: string;
	dbUrl: string;
	publishableKey: string;
	secretKey: string;
};

declare module "vitest" {
	export interface ProvidedContext {
		supabase: LocalStack;
	}
}

// Mirrors supabase/seed.sql. Local-only credentials; they open nothing hosted.
export const OWNER_USER_ID = "0b0e0000-0000-4000-8000-000000000001";
export const OWNER_EMAIL = "owner@dispatch.test";
export const OWNER_PASSWORD = "dispatch-local-owner";
