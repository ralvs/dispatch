import { act } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createDispatchStore } from "@/lib/store/create-store";
import { useClock, useView } from "@/lib/store/hooks";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { NOW, snapshot, T1, T2, T3, task } from "@/lib/store/test-fixtures";
import type { Snapshot } from "@/lib/store/types";

// Raw react-dom roots (not RTL's render) need the act environment flag.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const key = viewKey.tasks();
const snap: Snapshot = snapshot(T1, [
	{ key, type: "taskLists", data: { open: [task({ id: "a" }), task({ id: "b" })], done: [] } },
]);

function List({ onRender }: { onRender?: (ids: string[]) => void }) {
	const view = useView(key);
	const { todayIso } = useClock();
	const rows = [...(view?.open ?? []), ...(view?.done ?? [])];
	onRender?.(rows.map((r) => `${r.id}:${r.status}`));
	return (
		<ul data-today={todayIso}>
			{rows.map((r) => (
				<li key={r.id}>{`${r.id} ${r.status}`}</li>
			))}
		</ul>
	);
}

function App({
	store,
	onRender,
}: {
	store?: ReturnType<typeof createDispatchStore>;
	onRender?: (ids: string[]) => void;
}) {
	return (
		<StoreProvider store={store}>
			<Seed snapshot={snap}>
				<List onRender={onRender} />
			</Seed>
		</StoreProvider>
	);
}

describe("<Seed>", () => {
	it("server markup equals the first client render", async () => {
		const html = renderToString(<App />);
		expect(html).toContain("a open");

		const container = document.createElement("div");
		const root = createRoot(container);
		await act(async () => root.render(<App />));
		expect(container.innerHTML).toBe(html);
		root.unmount();
	});

	it("hydrates with zero recoverable errors", async () => {
		const html = renderToString(<App />);
		const container = document.createElement("div");
		container.innerHTML = html;
		document.body.appendChild(container);
		const onRecoverableError = vi.fn();
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		let root: ReturnType<typeof hydrateRoot> | undefined;
		await act(async () => {
			root = hydrateRoot(container, <App />, { onRecoverableError });
		});
		expect(onRecoverableError).not.toHaveBeenCalled();
		expect(errors.mock.calls).toEqual([]);
		expect(container.innerHTML).toBe(html);
		errors.mockRestore();
		root?.unmount();
		container.remove();
	});

	it("renders seeded rows on the first render", async () => {
		const onRender = vi.fn();
		const container = document.createElement("div");
		const root = createRoot(container);
		await act(async () => root.render(<App onRender={onRender} />));
		expect(onRender.mock.calls[0][0]).toEqual(["a:open", "b:open"]);
		root.unmount();
	});

	it("commits the snapshot into the real store", async () => {
		const store = createDispatchStore({ now: () => NOW });
		const container = document.createElement("div");
		const root = createRoot(container);
		await act(async () => root.render(<App store={store} />));
		expect(store.getState().clock?.todayIso).toBe(snap.todayIso);
		expect(store.getState().views[key]).toBeDefined();
		root.unmount();
	});

	it("a store holding a newer confirmed write renders it first over a stale snapshot", async () => {
		const store = createDispatchStore({ now: () => NOW });
		store.getState().seed(snapshot(T1, snap.views));
		const token = store.getState().apply({
			kind: "task",
			intent: { type: "complete", id: "a", observedDueDate: null },
		});
		store.getState().confirm(token, {
			at: T3,
			rows: [task({ id: "a", status: "done", completed_at: T2 })],
		});

		const stale: Snapshot = snapshot(T2, snap.views);
		const onRender = vi.fn();
		function StaleApp() {
			return (
				<StoreProvider store={store}>
					<Seed snapshot={stale}>
						<List onRender={onRender} />
					</Seed>
				</StoreProvider>
			);
		}
		const container = document.createElement("div");
		const root = createRoot(container);
		await act(async () => root.render(<StaleApp />));
		expect(onRender.mock.calls[0][0]).toEqual(["b:open", "a:done"]);
		root.unmount();
	});
});
