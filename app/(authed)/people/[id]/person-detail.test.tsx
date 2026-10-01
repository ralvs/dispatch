import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createFactAction,
	deleteInteractionAction,
	deletePersonAction,
	updatePersonAction,
} from "@/app/(authed)/people/[id]/actions";
import type { ActionResult } from "@/lib/action-result";
import { toastError } from "@/lib/client/toast";
import type { PersonFactRow } from "@/lib/schemas/person";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import {
	NOW,
	person,
	personFact,
	personInteraction,
	snapshot,
	T1,
	T2,
	TZ,
} from "@/lib/store/test-fixtures";
import type { StoreWrite } from "@/lib/store/types";
import { router } from "@/test/component/navigation";
import { PersonDetail } from "./person-detail";

vi.mock("@/app/(authed)/people/[id]/actions", () => ({
	updatePersonAction: vi.fn(),
	deletePersonAction: vi.fn(),
	createFactAction: vi.fn(),
	deleteFactAction: vi.fn(),
	createInteractionAction: vi.fn(),
	deleteInteractionAction: vi.fn(),
}));
vi.mock("@/lib/client/toast", () => ({ toastError: vi.fn() }));

const ANA = "ana";
const ana = person({ id: ANA, name: "Ana", company: "Acme" });
const call = personInteraction({ id: "call", person_id: ANA, notes: "Caught up" });

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
	vi.clearAllMocks();
});

function renderDetail() {
	const snap = snapshot(T1, [
		{ key: viewKey.people(), type: "personList", data: { rows: [ana] } },
		{ key: viewKey.person(ANA), type: "personList", data: { rows: [ana], scope: { id: ANA } } },
		{
			key: viewKey.personFacts(ANA),
			type: "personFactList",
			data: { rows: [], scope: { personId: ANA } },
		},
		{
			key: viewKey.personInteractions(ANA),
			type: "personInteractionList",
			data: { rows: [call], scope: { personId: ANA } },
		},
	]);
	render(
		<StoreProvider store={store}>
			<Seed snapshot={snap}>
				<PersonDetail personId={ANA} tz={TZ} mentionedTasks={[]} mentionedNotes={[]} />
			</Seed>
		</StoreProvider>,
	);
}

describe("PersonDetail on the entity store", () => {
	it("a new fact shows at once and the server's row confirms it", async () => {
		let resolve: (r: ActionResult<StoreWrite<PersonFactRow>>) => void = () => {};
		vi.mocked(createFactAction).mockReturnValue(
			new Promise((r) => {
				resolve = r;
			}),
		);
		const user = userEvent.setup();
		renderDetail();

		await user.click(screen.getByRole("button", { name: "+ Add fact" }));
		await user.type(screen.getByLabelText("Value"), "Likes jazz");
		await user.click(screen.getByRole("button", { name: "Add" }));
		expect(screen.getByText("Likes jazz")).toBeInTheDocument();

		const saved = personFact({ id: "saved", person_id: ANA, fact_value: "Likes jazz" });
		await act(async () => resolve({ ok: true, data: { at: T2, rows: [saved] } }));
		expect(screen.getAllByText("Likes jazz")).toHaveLength(1);
		expect(store.getState().pending).toEqual([]);
	});

	it("an edit shows at once in the header, and on /people", async () => {
		vi.mocked(updatePersonAction).mockResolvedValue({
			ok: true,
			data: { at: T2, rows: [{ ...ana, name: "Ana Lima" }] },
		});
		const user = userEvent.setup();
		renderDetail();

		await user.click(screen.getByRole("button", { name: "Edit Ana" }));
		const name = screen.getByDisplayValue("Ana");
		await user.clear(name);
		await user.type(name, "Ana Lima");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(await screen.findByRole("heading", { name: "Ana Lima" })).toBeInTheDocument();
		const people = store.getState().views[viewKey.people()];
		expect(people?.base).toEqual([{ ...ana, name: "Ana Lima" }]);
	});

	it("a failed interaction delete puts the row back", async () => {
		vi.mocked(deleteInteractionAction).mockRejectedValue(new Error("down"));
		const user = userEvent.setup();
		renderDetail();

		await user.click(screen.getByRole("button", { name: "Delete interaction" }));
		await waitFor(() => expect(toastError).toHaveBeenCalledWith("Couldn't delete interaction."));
		expect(screen.getByText("Caught up")).toBeInTheDocument();
	});

	it("delete goes to /people once the server confirms it", async () => {
		vi.mocked(deletePersonAction).mockResolvedValue({
			ok: true,
			data: { at: T2, rows: [], deletedIds: [ANA] },
		});
		const user = userEvent.setup();
		renderDetail();

		await user.click(screen.getByRole("button", { name: "Delete Ana" }));
		await waitFor(() => expect(router.push).toHaveBeenCalledWith("/people"));
		expect(store.getState().views[viewKey.people()]?.base).toEqual([]);
	});

	it("a failed delete keeps the page, and says so", async () => {
		vi.mocked(deletePersonAction).mockRejectedValue(new Error("down"));
		const user = userEvent.setup();
		renderDetail();

		await user.click(screen.getByRole("button", { name: "Delete Ana" }));
		await waitFor(() => expect(toastError).toHaveBeenCalledWith("Couldn't delete person."));
		expect(screen.getByRole("heading", { name: "Ana" })).toBeInTheDocument();
		expect(router.push).not.toHaveBeenCalled();
	});
});
