import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedHealth } from "@/lib/calendar-health";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { StoreProvider } from "@/lib/store/provider";
import { NOW } from "@/lib/store/test-fixtures";
import { pullTodayAction, syncIcloudCalendarAction } from "./actions";
import { CalendarHealthLine } from "./calendar-health-line";

vi.mock("./actions", () => ({
	syncIcloudCalendarAction: vi.fn(),
	pullTodayAction: vi.fn(),
}));
// The toast is the edge: runAction calls it from inside its own module.
const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: vi.fn() } }));

const TZ = "America/Sao_Paulo";
const TODAY = "2026-10-06";
const workStale: FeedHealth = { feed: "work", status: "stale", at: "2026-10-02T21:04:00.000Z" };
const icloudFailed: FeedHealth = {
	feed: "icloud",
	status: "failed",
	at: "2026-10-06T17:10:00.000Z",
};

let store: DispatchStore;
beforeEach(() => {
	vi.mocked(syncIcloudCalendarAction).mockReset();
	vi.mocked(pullTodayAction).mockReset().mockResolvedValue([]);
	toastErrorMock.mockReset();
	store = createDispatchStore({ now: () => NOW });
});

function renderLine(health: FeedHealth[]) {
	return render(
		<StoreProvider store={store}>
			<CalendarHealthLine health={health} tz={TZ} todayIso={TODAY} />
		</StoreProvider>,
	);
}

describe("CalendarHealthLine", () => {
	it("renders nothing when every feed is current", () => {
		const { container } = renderLine([]);
		expect(container).toBeEmptyDOMElement();
	});

	it("says which feed is behind, and offers Sync now only for iCloud", () => {
		renderLine([workStale, icloudFailed]);

		expect(
			screen.getByText(
				"Work calendar last synced Fri 18:04. The Mac bridge has not reported since.",
			),
		).toBeInTheDocument();
		expect(screen.getByText("iCloud calendar sync failed at 14:10.")).toBeInTheDocument();
		expect(screen.getAllByRole("button", { name: "Sync now" })).toHaveLength(1);
	});

	it("Sync now shows the feeds as the server answers, and pulls the day", async () => {
		vi.mocked(syncIcloudCalendarAction).mockResolvedValue({ ok: true, data: [workStale] });
		const user = userEvent.setup();
		renderLine([workStale, icloudFailed]);

		await user.click(screen.getByRole("button", { name: "Sync now" }));

		expect(await screen.findByText(/Work calendar last synced/)).toBeInTheDocument();
		expect(screen.queryByText(/iCloud calendar/)).not.toBeInTheDocument();
		expect(pullTodayAction).toHaveBeenCalledTimes(1);
	});

	it("a good sync with a failed day pull says the sync worked", async () => {
		vi.mocked(syncIcloudCalendarAction).mockResolvedValue({ ok: true, data: [] });
		vi.mocked(pullTodayAction).mockRejectedValue(new Error("offline"));
		const user = userEvent.setup();
		renderLine([icloudFailed]);

		await user.click(screen.getByRole("button", { name: "Sync now" }));

		await vi.waitFor(() =>
			expect(toastErrorMock).toHaveBeenCalledWith(
				"Synced. Couldn't refresh the day — it updates within five minutes.",
				expect.anything(),
			),
		);
		expect(screen.queryByText(/iCloud calendar/)).not.toBeInTheDocument();
	});

	it("a failed Sync now keeps the line and says so", async () => {
		vi.mocked(syncIcloudCalendarAction).mockResolvedValue({
			ok: false,
			formError: "Couldn't sync the iCloud calendar.",
		});
		const user = userEvent.setup();
		renderLine([icloudFailed]);

		await user.click(screen.getByRole("button", { name: "Sync now" }));

		expect(toastErrorMock).toHaveBeenCalledWith(
			"Couldn't sync the iCloud calendar.",
			expect.anything(),
		);
		expect(screen.getByText("iCloud calendar sync failed at 14:10.")).toBeInTheDocument();
		expect(pullTodayAction).not.toHaveBeenCalled();
	});
});
