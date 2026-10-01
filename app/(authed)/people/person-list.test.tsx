import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPersonAction } from "@/app/(authed)/people/actions";
import type { ActionResult } from "@/lib/action-result";
import type { PersonRow } from "@/lib/schemas/person";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { NOW, person, snapshot, T1, T2 } from "@/lib/store/test-fixtures";
import type { StoreWrite } from "@/lib/store/types";
import { getMeasure } from "@/test/component/measure";
import { PersonList } from "./person-list";

vi.mock("@/app/(authed)/people/actions", () => ({ createPersonAction: vi.fn() }));

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
});

describe("PersonList on the entity store", () => {
	it("a new person shows in place at once, and becomes a link once the server's row lands", async () => {
		let resolve: (r: ActionResult<StoreWrite<PersonRow>>) => void = () => {};
		vi.mocked(createPersonAction).mockReturnValue(
			new Promise((r) => {
				resolve = r;
			}),
		);
		render(
			<StoreProvider store={store}>
				<Seed
					snapshot={snapshot(T1, [
						{
							key: viewKey.people(),
							type: "personList",
							data: {
								rows: [person({ id: "ana", name: "Ana" }), person({ id: "caio", name: "Caio" })],
							},
						},
					])}
				>
					<PersonList />
				</Seed>
			</StoreProvider>,
		);
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "New person" }));
		await user.type(screen.getByLabelText("Person name"), "Bia");
		await user.click(screen.getByRole("button", { name: "Add person" }));

		expect(getMeasure(3, "people")).toBeInTheDocument();
		const names = () => screen.getAllByText(/^(Ana|Bia|Caio)$/).map((el) => el.textContent);
		expect(names()).toEqual(["Ana", "Bia", "Caio"]);
		// Its id is the client's until the server answers: no page to open yet.
		expect(screen.queryByRole("link", { name: "Bia" })).toBeNull();

		const bia = person({ id: "bia", name: "Bia" });
		await act(async () => resolve({ ok: true, data: { at: T2, rows: [bia] } }));
		expect(screen.getByRole("link", { name: "Bia" })).toHaveAttribute("href", "/people/bia");
	});
});
