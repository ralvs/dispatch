import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toastError } from "@/lib/client/toast";
import { createDispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { useRunIntent, useWrites } from "@/lib/store/run";
import { NOW, snapshot, T1, T2, TODAY, task } from "@/lib/store/test-fixtures";
import { type Write, write } from "@/lib/store/write";
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

describe("useWrites", () => {
	const okWrite = (
		call = vi.fn(async () => ({ ok: true as const, data: { at: T2, rows: [done] } })),
	) => write("task", intent, call, "Nope");
	const redirect = () =>
		Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/x;307;" });

	it("the call receives the ctx the intent was applied with", async () => {
		const { result } = renderHook(() => useWrites(), { wrapper });
		const w = okWrite();
		let ok = false;
		await act(async () => {
			ok = await result.current.save(w);
		});
		expect(ok).toBe(true);
		expect(w.call).toHaveBeenCalledWith(expect.objectContaining({ todayIso: TODAY, nowIso: NOW }));
		expect(store.getState().confirmed).toHaveLength(1);
	});

	it.each([
		{
			name: "a failure result",
			call: async () => ({ ok: false as const, formError: "Gone" }),
			toast: "Gone",
		},
		{
			name: "a generic failure result",
			call: async () => ({ ok: false as const, formError: "Something went wrong. Try again." }),
			toast: "Nope",
		},
		{
			name: "a throw",
			call: async () => {
				throw new Error("boom");
			},
			toast: "Nope",
		},
		{
			name: "a redirect",
			call: async () => {
				throw redirect();
			},
			toast: null,
		},
	])("save: $name → rollback, false", async ({ call, toast }) => {
		const { result } = renderHook(() => useWrites(), { wrapper });
		let ok = true;
		await act(async () => {
			ok = await result.current.save(write("task", intent, call, "Nope") as Write<"task">);
		});
		expect(ok).toBe(false);
		expect(store.getState().pending).toEqual([]);
		expect(store.getState().confirmed).toEqual([]);
		if (toast) expect(toastError).toHaveBeenCalledWith(toast);
		else expect(toastError).not.toHaveBeenCalled();
	});

	it("send: applies at once, confirms later, never rejects", async () => {
		const unhandled = vi.fn();
		process.on("unhandledRejection", unhandled);
		const { result } = renderHook(() => useWrites(), { wrapper });
		let ran = false;
		act(() => {
			ran = result.current.send(
				write("task", intent, async () => {
					throw new Error("boom");
				}),
			);
		});
		expect(ran).toBe(true);
		expect(store.getState().pending).toHaveLength(1);
		await flush();
		await new Promise((r) => setTimeout(r, 0));
		process.off("unhandledRejection", unhandled);
		expect(store.getState().pending).toEqual([]);
		expect(toastError).toHaveBeenCalledWith("Something went wrong. Try again.");
		expect(unhandled).not.toHaveBeenCalled();
	});

	it("send/save on a provisional row: nothing applied, nothing called, no toast", async () => {
		store.getState().apply({ kind: "task", intent: { type: "create", task: task({ id: "tmp" }) } });
		const { result } = renderHook(() => useWrites(), { wrapper });
		const call = vi.fn();
		const w = write("task", { type: "delete", id: "tmp" }, call);
		let sent = true;
		let saved = true;
		await act(async () => {
			sent = result.current.send(w);
			saved = await result.current.save(w);
		});
		expect([sent, saved]).toEqual([false, false]);
		expect(call).not.toHaveBeenCalled();
		expect(store.getState().pending).toHaveLength(1);
		expect(toastError).not.toHaveBeenCalled();
	});

	it("submit: returns the result untouched, no toast; a throw rolls back and rethrows", async () => {
		const { result } = renderHook(() => useWrites(), { wrapper });
		const failure = { ok: false as const, fieldErrors: { title: ["Required"] } };
		await act(async () => {
			expect(await result.current.submit(write("task", intent, async () => failure))).toBe(failure);
		});
		expect(store.getState().pending).toEqual([]);
		expect(toastError).not.toHaveBeenCalled();

		const boom = new Error("boom");
		await act(async () => {
			await expect(
				result.current.submit(
					write("task", intent, async () => {
						throw boom;
					}),
				),
			).rejects.toBe(boom);
		});
		expect(store.getState().pending).toEqual([]);
		expect(toastError).not.toHaveBeenCalled();
	});

	it("adopt: applies and confirms at once", () => {
		const { result } = renderHook(() => useWrites(), { wrapper });
		act(() => result.current.adopt("task", intent, { at: T2, rows: [done] }));
		expect(store.getState().pending).toEqual([]);
		expect(store.getState().confirmed).toHaveLength(1);
	});
});
