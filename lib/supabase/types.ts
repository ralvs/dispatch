import type { SupabaseClient as Base } from "@supabase/supabase-js";
import type { Database } from "@/lib/database";

/** The one Supabase client type, typed by the generated schema (docs/adr/0089). */
export type SupabaseClient = Base<Database>;
