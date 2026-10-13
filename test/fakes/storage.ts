import { vi } from "vitest";
import type { StorageObject, StoragePort } from "@/lib/storage/types";

// An in-memory stand-in for the storage port (docs/adr/0088). Tests pass it
// as `{ storage }`; app code never imports this. Each method is a `vi.fn`, so
// a test can assert calls or force a failure with `mockRejectedValueOnce`.

export type FakeStorage = {
	[K in keyof StoragePort]: ReturnType<typeof vi.fn<StoragePort[K]>>;
} & { objects: Map<string, StorageObject> };

export function fakeStorage(seed: Record<string, StorageObject> = {}): FakeStorage {
	const objects = new Map<string, StorageObject>(Object.entries(seed));
	return {
		objects,
		putObject: vi.fn<StoragePort["putObject"]>(async (key, bytes, contentType) => {
			objects.set(key, { bytes, contentType });
		}),
		getObject: vi.fn<StoragePort["getObject"]>(async (key) => objects.get(key) ?? null),
		deleteObjects: vi.fn<StoragePort["deleteObjects"]>(async (keys) => {
			for (const key of keys) objects.delete(key);
		}),
		listPrefix: vi.fn<StoragePort["listPrefix"]>(async (prefix) =>
			[...objects.keys()].filter((key) => key.startsWith(prefix)),
		),
	};
}
