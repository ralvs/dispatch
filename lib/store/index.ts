// Client pieces of the entity store. `./server` is imported directly.
export { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
export {
	useAggregate,
	useClock,
	useConfirmedWrites,
	useProvisionalIds,
	useStoreActions,
	useView,
} from "@/lib/store/hooks";
export { viewKey } from "@/lib/store/keys";
export { StoreProvider, useDispatchStore } from "@/lib/store/provider";
export {
	isNavigationError,
	useInlineEdit,
	useRunIntent,
	useStoreWrite,
	useWrites,
	type Writes,
} from "@/lib/store/run";
export { Seed } from "@/lib/store/seed";
export type * from "@/lib/store/types";
export { type Write, type WriteResult, write } from "@/lib/store/write";
