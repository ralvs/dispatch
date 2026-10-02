import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pullTodayAction } from "@/app/(authed)/today/actions";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { StoreProvider } from "@/lib/store/provider";
import { snapshot, T1, TODAY } from "@/lib/store/test-fixtures";
import { router } from "@/test/component/navigation";
import { SoftRefresh } from "./soft-refresh";

vi.mock("@/app/(authed)/today/actions", () => ({ pullTodayAction: vi.fn() }));

const MINUTE = 60_000;
let store: DispatchStore;

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	store = createDispatchStore();
});
afterEach(() => vi.useRealTimers());

function mount() {
	render(
		<StoreProvider store={store}>
			<SoftRefresh todayIso={TODAY} />
		</StoreProvider>,
	);
}

describe("SoftRefresh", () => {
	it("every five minutes pulls Today into the store, with no page render", async () => {
		vi.mocked(pullTodayAction).mockResolvedValue([
			snapshot(T1, [], { aggregates: { "notifications.unread": 4 } }),
		]);
		mount();
		await act(async () => vi.advanceTimersByTime(4 * MINUTE));
		expect(pullTodayAction).not.toHaveBeenCalled();

		await act(async () => vi.advanceTimersByTime(MINUTE));
		expect(pullTodayAction).toHaveBeenCalledTimes(1);
		expect(store.getState().aggregates["notifications.unread"]?.value).toBe(4);
		expect(router.refresh).not.toHaveBeenCalled();
	});

	it("past midnight the server's today is newer: the page refreshes once, onto the new day", async () => {
		vi.mocked(pullTodayAction).mockResolvedValue([{ ...snapshot(T1), todayIso: "2026-07-16" }]);
		mount();
		await act(async () => vi.advanceTimersByTime(5 * MINUTE));
		expect(router.refresh).toHaveBeenCalledTimes(1);
		expect(store.getState().clock).toBeNull();
	});

	it("a failed pull leaves the screen as it was", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.mocked(pullTodayAction).mockRejectedValue(new Error("offline"));
		mount();
		await act(async () => vi.advanceTimersByTime(5 * MINUTE));
		expect(router.refresh).not.toHaveBeenCalled();
		expect(store.getState().clock).toBeNull();
		error.mockRestore();
	});
});
