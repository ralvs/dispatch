import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/action-result";
import { assignDomainAction } from "@/lib/actions/tasks";
import { toastError } from "@/lib/client/toast";
import type { TaskRow } from "@/lib/schemas/task";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { NOW, snapshot, T1, T2, task } from "@/lib/store/test-fixtures";
import type { StoreWrite } from "@/lib/store/types";
import { InboxList } from "./inbox-list";

vi.mock("@/lib/actions/tasks", () => ({
	assignDomainAction: vi.fn(),
	deleteTaskAction: vi.fn(),
}));
vi.mock("@/lib/client/toast", () => ({ toastError: vi.fn() }));

type Result = ActionResult<StoreWrite<TaskRow>>;

const HOME = { id: "domain-home", name: "Home", color: null };
const rent = task({ id: "rent", title: "Pay rent", domain_id: null });

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
});

function renderInbox() {
	const snap = snapshot(T1, [
		{
			key: viewKey.inbox(),
			type: "taskList",
			data: { rows: [rent], scope: { unfiled: true, status: "open" } },
		},
	]);
	render(
		<StoreProvider store={store}>
			<Seed snapshot={snap}>
				<InboxList domains={[HOME]} taskNoteIds={{}} />
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

const fileButton = () => screen.queryByRole("button", { name: "Move Pay rent to Home" });

describe("InboxList on the entity store", () => {
	it("filing takes the row out at once, and the server's row keeps it out", async () => {
		const action = deferred();
		vi.mocked(assignDomainAction).mockReturnValue(action.promise);
		const user = userEvent.setup();
		renderInbox();

		await user.click(fileButton() as HTMLElement);
		expect(assignDomainAction).toHaveBeenCalledWith("rent", "domain-home");
		expect(screen.getByText("The inbox is empty. Well kept.")).toBeInTheDocument();

		const filed = task({ id: "rent", title: "Pay rent", domain_id: "domain-home" });
		await act(async () => action.resolve({ ok: true, data: { at: T2, rows: [filed] } }));
		expect(fileButton()).not.toBeInTheDocument();
		expect(store.getState().pending).toEqual([]);
	});

	it("a failed filing puts the row back and says so", async () => {
		const action = deferred();
		vi.mocked(assignDomainAction).mockReturnValue(action.promise);
		const user = userEvent.setup();
		renderInbox();

		await user.click(fileButton() as HTMLElement);
		expect(fileButton()).not.toBeInTheDocument();
		await act(async () => action.resolve({ ok: false, formError: "Couldn't file task." }));
		expect(fileButton()).toBeInTheDocument();
		expect(toastError).toHaveBeenCalledWith("Couldn't file task.");
	});
});
