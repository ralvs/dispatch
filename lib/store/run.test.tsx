import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toastError } from "@/lib/client/toast";
import { createDispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { useRunIntent } from "@/lib/store/run";
import { NOW, snapshot, T1, T2, task } from "@/lib/store/test-fixtures";
import type { TaskIntent } from "@/lib/task-interaction/apply-intent";

vi.mock("@/lib/client/toast", () => ({ toastError: vi.fn() }));
vi.mock("next/navigation", async () => {
	const { nextNavigationMock } = await import("@/test/component/navigation");
	return { ...nextNavigationMock, unstable_rethrow: vi.fn() };
});

const intent: TaskIntent = { type: "complete", id: "a", observedDueDate: null };
const done = task({ id: "a", status: "done", completed_at: NOW });

let store: ReturnType<typeof createDispatchStore>;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
	store
		.getState()
		.seed(
			snapshot(T1, [
				{ key: viewKey.tasks(), type: "taskLists", data: { open: [task({ id: "a" })], done: [] } },
			]),
		);
});

function wrapper({ children }: { children: ReactNode }) {
	return <StoreProvider store={store}>{children}</StoreProvider>;
}

const flush = () => act(async () => {});

describe("useRunIntent", () => {
	it("ok → confirm, then release", async () => {
		const lock = { claim: vi.fn(() => true), release: vi.fn() };
		const { result } = renderHook(() => useRunIntent("task", { lock }), { wrapper });
		let ran = false;
		act(() => {
			ran = result.current(intent, async () => ({ ok: true, data: { at: T2, rows: [done] } }));
		});
		expect(ran).toBe(true);
		expect(store.getState().pending).toHaveLength(1);
		await flush();
		expect(store.getState().pending).toEqual([]);
		expect(store.getState().confirmed).toHaveLength(1);
		expect(lock.release).toHaveBeenCalledWith(intent);
	});

	it("ok:false → rollback + toast", async () => {
		const { result } = renderHook(() => useRunIntent("task", { errorMessage: "Nope" }), {
			wrapper,
		});
		act(() => {
			result.current(intent, async () => ({ ok: false, formError: "Gone" }));
		});
		await flush();
		expect(store.getState().pending).toEqual([]);
		expect(store.getState().confirmed).toEqual([]);
		expect(toastError).toHaveBeenCalledWith("Gone");
	});

	it("throw → rollback + toast", async () => {
		const { result } = renderHook(() => useRunIntent("task", { errorMessage: "Nope" }), {
			wrapper,
		});
		act(() => {
			result.current(intent, async () => {
				throw new Error("network");
			});
		});
		await flush();
		expect(store.getState().pending).toEqual([]);
		expect(toastError).toHaveBeenCalledWith("Nope");
	});

	it("a refused claim applies nothing", () => {
		const lock = { claim: vi.fn(() => false), release: vi.fn() };
		const action = vi.fn();
		const { result } = renderHook(() => useRunIntent("task", { lock }), { wrapper });
		expect(result.current(intent, action)).toBe(false);
		expect(action).not.toHaveBeenCalled();
		expect(store.getState().pending).toEqual([]);
	});
});
