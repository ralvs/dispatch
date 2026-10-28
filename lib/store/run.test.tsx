import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toastError, toastSuccess } from "@/lib/client/toast";
import { createDispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { useWrites } from "@/lib/store/run";
import { NOW, snapshot, T1, T2, TODAY, task } from "@/lib/store/test-fixtures";
import { successCopy, type Write, write } from "@/lib/store/write";
import type { TaskIntent } from "@/lib/task-interaction/apply-intent";

vi.mock("@/lib/client/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

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

	it("a confirm toasts the write's success copy: its own, the default, or none", async () => {
		const { result } = renderHook(() => useWrites(), { wrapper });
		const ok = async () => ({ ok: true as const, data: { at: T2, rows: [done] } });
		const del: TaskIntent = { type: "delete", id: "a" };

		vi.mocked(toastSuccess).mockClear();
		await act(async () => {
			await result.current.save(write("task", del, ok));
		});
		expect(toastSuccess).toHaveBeenCalledWith("Task deleted");

		vi.mocked(toastSuccess).mockClear();
		await act(async () => {
			await result.current.save(write("task", del, ok, undefined, "Gone for good"));
		});
		expect(toastSuccess).toHaveBeenCalledWith("Gone for good");

		vi.mocked(toastSuccess).mockClear();
		await act(async () => {
			await result.current.save(write("task", del, ok, undefined, null));
		});
		expect(toastSuccess).not.toHaveBeenCalled();
	});

	it("submit toasts on confirm, and never on a refusal", async () => {
		const { result } = renderHook(() => useWrites(), { wrapper });
		const edit: TaskIntent = { type: "edit", id: "a" };
		vi.mocked(toastSuccess).mockClear();
		await act(async () => {
			await result.current.submit(
				write("task", edit, async () => ({ ok: false as const, formError: "No" })),
			);
		});
		expect(toastSuccess).not.toHaveBeenCalled();
		await act(async () => {
			await result.current.submit(
				write("task", edit, async () => ({ ok: true as const, data: { at: T2, rows: [done] } })),
			);
		});
		expect(toastSuccess).toHaveBeenCalledWith("Task updated");
	});

	it("a task tick, skip or reopen confirms silently: toastTaskToggle already spoke", async () => {
		const { result } = renderHook(() => useWrites(), { wrapper });
		vi.mocked(toastSuccess).mockClear();
		await act(async () => {
			await result.current.save(okWrite());
		});
		expect(toastSuccess).not.toHaveBeenCalled();
	});

	it("adopt: applies and confirms at once", () => {
		const { result } = renderHook(() => useWrites(), { wrapper });
		act(() => result.current.adopt("task", intent, { at: T2, rows: [done] }));
		expect(store.getState().pending).toEqual([]);
		expect(store.getState().confirmed).toHaveLength(1);
	});
});

describe("save with onFieldErrors", () => {
	const refused = async () => ({ ok: false as const, fieldErrors: { name: ["Required"] } });

	it("hands field errors over and skips the toast", async () => {
		vi.mocked(toastError).mockClear();
		const { result } = renderHook(() => useWrites(), { wrapper });
		const onFieldErrors = vi.fn();
		await act(async () => {
			await result.current.save(write("task", intent, refused, "Nope"), { onFieldErrors });
		});
		expect(onFieldErrors).toHaveBeenCalledWith({ fieldErrors: { name: ["Required"] } });
		expect(toastError).not.toHaveBeenCalled();
	});

	it("without it, field errors still toast", async () => {
		vi.mocked(toastError).mockClear();
		const { result } = renderHook(() => useWrites(), { wrapper });
		await act(async () => {
			await result.current.save(write("task", intent, refused, "Nope"));
		});
		expect(toastError).toHaveBeenCalledWith("Nope");
	});

	it("a form error still toasts, even with field errors beside it", async () => {
		vi.mocked(toastError).mockClear();
		const { result } = renderHook(() => useWrites(), { wrapper });
		const onFieldErrors = vi.fn();
		const both = async () => ({
			ok: false as const,
			formError: "Boom",
			fieldErrors: { name: ["Required"] },
		});
		await act(async () => {
			await result.current.save(write("task", intent, both, "Nope"), { onFieldErrors });
		});
		expect(onFieldErrors).not.toHaveBeenCalled();
		expect(toastError).toHaveBeenCalled();
	});
});

describe("successCopy", () => {
	it.each([
		[{ kind: "quote", intent: { type: "delete", id: "q" } }, "Quote deleted"],
		[{ kind: "journal", intent: { type: "patch", id: "j", patch: {} } }, "Entry updated"],
		[{ kind: "note", intent: { type: "pin", id: "n", pinned: false } }, "Unpinned"],
		[{ kind: "note", intent: { type: "save", id: "n", title: null, body: "" } }, null],
		[{ kind: "notification", intent: { type: "markAll", status: "dismissed" } }, "All dismissed"],
		[
			{ kind: "routine", intent: { type: "toggle", id: "r", date: TODAY, done: true } },
			"Routine done",
		],
		[
			{ kind: "task", intent: { type: "setTop3", id: "a", starred: true, forDateIso: TODAY } },
			"Starred",
		],
	] as const)("%o → %s", (input, copy) => {
		expect(successCopy(input as Parameters<typeof successCopy>[0])).toBe(copy);
	});
});
