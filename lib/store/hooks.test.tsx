import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDispatchStore } from "@/lib/store/create-store";
import { useAggregate, useView } from "@/lib/store/hooks";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { NOW, snapshot, T1, T2, task } from "@/lib/store/test-fixtures";

const intent = { type: "complete", id: "a", observedDueDate: null } as const;

describe("createDispatchStore.apply", () => {
	it("a seed landing during an apply is not lost", () => {
		const late = snapshot(T2, [
			{ key: viewKey.inbox(), type: "taskList", data: { rows: [task({ id: "z" })] } },
		]);
		let seeded = false;
		const store = createDispatchStore({
			now: () => {
				if (!seeded) {
					seeded = true;
					store.getState().seed(late);
				}
				return NOW;
			},
		});
		store.getState().seed(snapshot(T1));
		const token = store.getState().apply({ kind: "task", intent });
		expect(store.getState().views[viewKey.inbox()]).toBeDefined();
		expect(store.getState().pending.map((p) => p.token)).toEqual([token]);
	});
});

describe("hook subscriptions", () => {
	it("an apply on a view does not re-render an unrelated aggregate's consumer", () => {
		const store = createDispatchStore({ now: () => NOW });
		store.getState().seed(
			snapshot(
				T1,
				[
					{
						key: viewKey.tasks(),
						type: "taskLists",
						data: { open: [task({ id: "a" })], done: [] },
					},
				],
				{ aggregates: { "notifications.unread": 3 } },
			),
		);
		const aggRenders = vi.fn();
		const viewRenders = vi.fn();
		function Badge() {
			aggRenders(useAggregate("notifications.unread"));
			return null;
		}
		function List() {
			viewRenders(useView(viewKey.tasks()));
			return null;
		}
		render(
			<StoreProvider store={store}>
				<Badge />
				<List />
			</StoreProvider>,
		);
		expect(aggRenders).toHaveBeenCalledTimes(1);
		act(() => {
			store.getState().apply({ kind: "task", intent });
		});
		expect(viewRenders).toHaveBeenCalledTimes(2);
		expect(aggRenders).toHaveBeenCalledTimes(1);
		expect(aggRenders).toHaveBeenLastCalledWith(3);
	});

	it("useView returns the same reference when nothing relevant changed", () => {
		const store = createDispatchStore({ now: () => NOW });
		store.getState().seed(
			snapshot(T1, [
				{
					key: viewKey.tasks(),
					type: "taskLists",
					data: { open: [task({ id: "a" })], done: [] },
				},
			]),
		);
		const seen: unknown[] = [];
		function List() {
			seen.push(useView(viewKey.tasks()));
			return null;
		}
		const { rerender } = render(
			<StoreProvider store={store}>
				<List />
			</StoreProvider>,
		);
		rerender(
			<StoreProvider store={store}>
				<List />
			</StoreProvider>,
		);
		expect(seen).toHaveLength(2);
		expect(seen[1]).toBe(seen[0]);
	});
});
