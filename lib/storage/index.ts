import "server-only";

/*
 * The storage port (docs/adr/0052). Everything that moves bytes imports from
 * here; nothing imports the adapter directly. Swapping provider is then one
 * new module and one changed re-export, with no database migration — the keys
 * and the persisted /api/media URLs stay valid.
 */
import { deleteObjects, getObject, listPrefix, putObject } from "./r2";
import type { StoragePort } from "./types";

export type { StorageObject, StoragePort } from "./types";
export { deleteObjects, getObject, listPrefix, putObject };

/** The port as one value, the default for every `{ storage?: StoragePort }` (docs/adr/0088). */
export const storage: StoragePort = { putObject, getObject, deleteObjects, listPrefix };
