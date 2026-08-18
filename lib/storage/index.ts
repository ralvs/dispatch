import "server-only";

/*
 * The storage port (docs/adr/0052). Everything that moves bytes imports from
 * here; nothing imports the adapter directly. Swapping provider is then one
 * new module and one changed re-export, with no database migration — the keys
 * and the persisted /api/media URLs stay valid.
 */
export { deleteObjects, getObject, listPrefix, putObject } from "./r2";
export type { StorageObject, StoragePort } from "./types";
