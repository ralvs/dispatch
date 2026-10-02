import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/action-result";
import { toggleCompletionAction } from "@/lib/actions/routines";
import { toastError } from "@/lib/client/toast";
import type { RoutineWithHistory } from "@/lib/schemas/routine";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { NOW, routine, snapshot, T1, T2, TODAY } from "@/lib/store/test-fixtures";
import type { StoreWrite } from "@/lib/store/types";
import { RoutinesCard } from "./routines-card";

vi.mock("@/lib/actions/routines", () => ({ toggleCompletionAction: vi.fn() }));
vi.mock("@/lib/client/toast", () => ({ toastError: vi.fn() }));

type Result = ActionResult<StoreWrite<RoutineWithHistory>>;

const stretch = routine({ id: "stretch", name: "Stretch", time_of_day: "morning" });
const read = routine({ id: "read", name: "Read", completions: [TODAY] });

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
});

function renderCard() {
	const snap = snapshot(T1, [
		{ key: viewKey.routines(), type: "routineList", data: [stretch, read] },
	]);
	render(
		<StoreProvider store={store}>
			<Seed snapshot={snap}>
				<RoutinesCard nowMs={Date.parse(NOW)} />
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

const progress = () => screen.getByLabelText(/routines done today/);

describe("RoutinesCard on the entity store", () => {
	it("a tick flips at once, moves the count, and the server's row confirms it", async () => {
		const action = deferred();
		vi.mocked(toggleCompletionAction).mockReturnValue(action.promise);
		const user = userEvent.setup();
		renderCard();

		expect(progress()).toHaveAccessibleName("1 of 2 routines done today");
		await user.click(screen.getByRole("checkbox", { name: 'Complete "Stretch"' }));
		expect(toggleCompletionAction).toHaveBeenCalledWith("stretch", false);
		expect(progress()).toHaveAccessibleName("2 of 2 routines done today");

		const done = { ...stretch, completions: [TODAY] };
		await act(async () => action.resolve({ ok: true, data: { at: T2, rows: [done] } }));
		expect(screen.getByRole("checkbox", { name: 'Undo "Stretch"' })).toBeChecked();
		expect(store.getState().pending).toEqual([]);
	});

	it("a failed tick puts the box back and says so", async () => {
		const action = deferred();
		vi.mocked(toggleCompletionAction).mockReturnValue(action.promise);
		const user = userEvent.setup();
		renderCard();

		await user.click(screen.getByRole("checkbox", { name: 'Undo "Read"' }));
		expect(progress()).toHaveAccessibleName("0 of 2 routines done today");
		await act(async () => action.resolve({ ok: false, formError: "Couldn't update routine." }));
		expect(screen.getByRole("checkbox", { name: 'Undo "Read"' })).toBeChecked();
		expect(toastError).toHaveBeenCalledWith("Couldn't update routine.");
	});
});
