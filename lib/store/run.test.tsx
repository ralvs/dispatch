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
	it("ok → confirm", async () => {
		const { result } = renderHook(() => useRunIntent("task"), { wrapper });
		let ran = false;
		act(() => {
			ran = result.current(intent, async () => ({ ok: true, data: { at: T2, rows: [done] } }));
		});
		expect(ran).toBe(true);
		expect(store.getState().pending).toHaveLength(1);
		await flush();
		expect(store.getState().pending).toEqual([]);
		expect(store.getState().confirmed).toHaveLength(1);
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

	it.each([
		{ name: "a plain error", error: () => new Error("boom"), toasts: true },
		{
			// A Next control-flow error: the router navigates, so no failure toast.
			name: "a redirect",
			error: () =>
				Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/x;307;" }),
			toasts: false,
		},
	])("throw ($name) → rollback, no unhandled rejection", async ({ error, toasts }) => {
		const unhandled = vi.fn();
		process.on("unhandledRejection", unhandled);
		const { result } = renderHook(() => useRunIntent("task", { errorMessage: "Nope" }), {
			wrapper,
		});
		act(() => {
			result.current(intent, async () => {
				throw error();
			});
		});
		await flush();
		await new Promise((r) => setTimeout(r, 0));
		process.off("unhandledRejection", unhandled);
		expect(store.getState().pending).toEqual([]);
		expect(store.getState().confirmed).toEqual([]);
		if (toasts) expect(toastError).toHaveBeenCalledWith("Nope");
		else expect(toastError).not.toHaveBeenCalled();
		expect(unhandled).not.toHaveBeenCalled();
	});

	it("swallows an intent on a row whose create is unconfirmed, and nothing runs", async () => {
		const draft = task({ id: "tmp" });
		store.getState().apply({ kind: "task", intent: { type: "create", task: draft } });
		const { result } = renderHook(() => useRunIntent("task"), { wrapper });
		const action = vi.fn();
		let ran = true;
		act(() => {
			ran = result.current({ type: "delete", id: "tmp" }, action);
		});
		expect(ran).toBe(false);
		expect(action).not.toHaveBeenCalled();
		expect(store.getState().pending).toHaveLength(1);
	});
});
