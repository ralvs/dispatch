import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLinkStatusAction } from "@/app/(authed)/links/actions";
import type { ActionResult } from "@/lib/action-result";
import { toastError } from "@/lib/client/toast";
import type { LinkRow } from "@/lib/schemas/link";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { link, NOW, snapshot, T1, T2 } from "@/lib/store/test-fixtures";
import type { StoreWrite } from "@/lib/store/types";
import { getMeasure } from "@/test/component/measure";
import { LinkList } from "./link-list";

vi.mock("@/app/(authed)/links/actions", () => ({ setLinkStatusAction: vi.fn() }));
vi.mock("@/lib/client/toast", () => ({ toastError: vi.fn() }));

type Result = ActionResult<StoreWrite<LinkRow>>;

const post = link({ id: "post", title: "A post" });
const essay = link({ id: "essay", title: "An essay", status: "read" });

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
});

function renderList() {
	const snap = snapshot(T1, [
		{ key: viewKey.links(), type: "linkList", data: { rows: [post, essay] } },
	]);
	render(
		<StoreProvider store={store}>
			<Seed snapshot={snap}>
				<LinkList />
			</Seed>
		</StoreProvider>,
	);
}

const section = (name: string) => screen.getByRole("heading", { name }).closest("section");

describe("LinkList on the entity store", () => {
	it("mark read moves the link from Unread to Read at once; the server's row confirms it", async () => {
		let resolve: (r: Result) => void = () => {};
		vi.mocked(setLinkStatusAction).mockReturnValue(
			new Promise<Result>((r) => {
				resolve = r;
			}),
		);
		const user = userEvent.setup();
		renderList();
		expect(getMeasure(1, "unread")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Mark read" }));
		expect(setLinkStatusAction).toHaveBeenCalledWith("post", "read");
		expect(screen.queryByRole("heading", { name: "Unread" })).toBeNull();
		const read = section("Read");
		expect(read && within(read).getByText("A post")).toBeInTheDocument();

		await act(async () =>
			resolve({ ok: true, data: { at: T2, rows: [{ ...post, status: "read" }] } }),
		);
		expect(store.getState().pending).toEqual([]);
		expect(getMeasure(2, "read")).toBeInTheDocument();
	});

	it("dismiss takes the link out; a failure puts it back", async () => {
		vi.mocked(setLinkStatusAction).mockResolvedValue({ ok: false, formError: "Nope." });
		const user = userEvent.setup();
		renderList();

		await user.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
		await waitFor(() => expect(toastError).toHaveBeenCalledWith("Nope."));
		expect(screen.getByText("A post")).toBeInTheDocument();
		expect(getMeasure(1, "unread")).toBeInTheDocument();
	});
});
