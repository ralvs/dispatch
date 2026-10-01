import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	markAllNotificationsAction,
	markNotificationAction,
} from "@/app/(authed)/notifications/actions";
import type { ActionResult } from "@/lib/action-result";
import { toastError } from "@/lib/client/toast";
import type { NotificationRow } from "@/lib/schemas/notification";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { NOW, notification, snapshot, T1, T2, TZ } from "@/lib/store/test-fixtures";
import type { StoreWrite } from "@/lib/store/types";
import { NotificationList } from "./notification-list";

vi.mock("@/app/(authed)/notifications/actions", () => ({
	markNotificationAction: vi.fn(),
	markAllNotificationsAction: vi.fn(),
}));
vi.mock("@/lib/client/toast", () => ({ toastError: vi.fn() }));

type Result = ActionResult<StoreWrite<NotificationRow>>;

const synced = notification({ id: "synced", title: "Calendar synced" });
const filed = notification({ id: "filed", title: "Note filed" });

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
});

function renderList() {
	const snap = snapshot(
		T1,
		[{ key: viewKey.notifications(), type: "notificationList", data: [synced, filed] }],
		{ aggregates: { "notifications.unread": 2 } },
	);
	render(
		<StoreProvider store={store}>
			<Seed snapshot={snap}>
				<NotificationList tz={TZ} />
			</Seed>
		</StoreProvider>,
	);
}

function deferred() {
	let resolve: (r: Result) => void = () => {};
	const promise = new Promise<Result>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

const unreadCount = () => store.getState().aggregates["notifications.unread"]?.value;

describe("NotificationList on the entity store", () => {
	it("mark read flips the row at once, and the server's row confirms it", async () => {
		const action = deferred();
		vi.mocked(markNotificationAction).mockReturnValue(action.promise);
		const user = userEvent.setup();
		renderList();

		expect(screen.getByText(/2 unread/)).toBeInTheDocument();
		await user.click(screen.getAllByRole("button", { name: "Mark read" })[0]);
		expect(markNotificationAction).toHaveBeenCalledWith("synced", "read");
		expect(screen.getByText(/1 unread/)).toBeInTheDocument();

		const read = { ...synced, status: "read" as const };
		await act(async () => action.resolve({ ok: true, data: { at: T2, rows: [read] } }));
		expect(screen.getByText(/1 unread/)).toBeInTheDocument();
		expect(store.getState().pending).toEqual([]);
		expect(unreadCount()).toBe(1);
	});

	it("dismiss all empties the list, and the server's ids keep it empty", async () => {
		const action = deferred();
		vi.mocked(markAllNotificationsAction).mockReturnValue(action.promise);
		const user = userEvent.setup();
		renderList();

		await user.click(screen.getByRole("button", { name: "Dismiss all" }));
		await user.click(screen.getByRole("button", { name: "Confirm" }));
		expect(markAllNotificationsAction).toHaveBeenCalledWith("dismissed");
		expect(screen.getByText("Nothing to report. The wire is quiet.")).toBeInTheDocument();

		await act(async () =>
			action.resolve({ ok: true, data: { at: T2, rows: [], deletedIds: ["synced", "filed"] } }),
		);
		expect(screen.getByText("Nothing to report. The wire is quiet.")).toBeInTheDocument();
		expect(unreadCount()).toBe(0);
	});

	it("a failed mark puts the row back and says so", async () => {
		const action = deferred();
		vi.mocked(markNotificationAction).mockReturnValue(action.promise);
		const user = userEvent.setup();
		renderList();

		await user.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
		expect(screen.queryByText("Calendar synced")).not.toBeInTheDocument();
		await act(async () =>
			action.resolve({ ok: false, formError: "Couldn't update notification." }),
		);
		expect(screen.getByText("Calendar synced")).toBeInTheDocument();
		expect(toastError).toHaveBeenCalledWith("Couldn't update notification.");
		expect(unreadCount()).toBe(2);
	});
});
