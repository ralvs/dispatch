import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuoteAction, deleteQuoteAction } from "@/app/(authed)/quotes/actions";
import type { ActionResult } from "@/lib/action-result";
import { toastError } from "@/lib/client/toast";
import type { QuoteRow } from "@/lib/schemas/quote";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { NOW, quote, snapshot, T1, T2 } from "@/lib/store/test-fixtures";
import type { StoreWrite } from "@/lib/store/types";
import { getMeasure } from "@/test/component/measure";
import { QuoteList } from "./quote-list";

vi.mock("@/app/(authed)/quotes/actions", () => ({
	createQuoteAction: vi.fn(),
	deleteQuoteAction: vi.fn(),
	createAnnotationAction: vi.fn(),
	listAnnotationsAction: vi.fn(),
}));
vi.mock("@/lib/client/toast", () => ({ toastError: vi.fn(), runAction: vi.fn() }));

type Result = ActionResult<StoreWrite<QuoteRow>>;

const seneca = quote({ id: "seneca", text: "We suffer more in imagination" });

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
});

function renderList() {
	const snap = snapshot(T1, [
		{ key: viewKey.quotes(), type: "quoteList", data: { rows: [seneca] } },
	]);
	render(
		<StoreProvider store={store}>
			<Seed snapshot={snap}>
				<QuoteList />
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

async function addQuote(user: ReturnType<typeof userEvent.setup>, text: string) {
	await user.click(screen.getByRole("button", { name: "New quote" }));
	await user.type(screen.getByLabelText("Quote text"), text);
	await user.click(screen.getByRole("button", { name: "Add quote" }));
}

describe("QuoteList on the entity store", () => {
	it("a new quote shows at once and the count moves, with no page render", async () => {
		const action = deferred();
		vi.mocked(createQuoteAction).mockReturnValue(action.promise);
		const user = userEvent.setup();
		renderList();
		expect(getMeasure(1, "saved")).toBeInTheDocument();

		await addQuote(user, "Amor fati");
		expect(screen.getByText("“Amor fati”")).toBeInTheDocument();
		expect(getMeasure(2, "saved")).toBeInTheDocument();

		const saved = quote({
			id: "saved",
			text: "Amor fati",
			created_at: "2026-07-15T12:02:31+00:00",
		});
		await act(async () => action.resolve({ ok: true, data: { at: T2, rows: [saved] } }));
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
		expect(screen.getAllByText("“Amor fati”")).toHaveLength(1);
		expect(store.getState().pending).toEqual([]);
	});

	it("a rejected field takes the new quote back out and keeps the dialog open", async () => {
		vi.mocked(createQuoteAction).mockResolvedValue({
			ok: false,
			fieldErrors: { text: ["Write the quote."] },
			values: { text: " " },
		});
		const user = userEvent.setup();
		renderList();

		await addQuote(user, " ");
		expect(await screen.findByText("Write the quote.")).toBeInTheDocument();
		expect(getMeasure(1, "saved")).toBeInTheDocument();
		expect(store.getState().pending).toEqual([]);
	});

	it("a delete leaves at once; a failure puts the quote back", async () => {
		vi.mocked(deleteQuoteAction).mockRejectedValue(new Error("down"));
		const user = userEvent.setup();
		renderList();

		await user.click(screen.getByRole("button", { name: /Delete quote/ }));
		await waitFor(() => expect(toastError).toHaveBeenCalledWith("Couldn't delete quote."));
		expect(screen.getByText("“We suffer more in imagination”")).toBeInTheDocument();
		expect(getMeasure(1, "saved")).toBeInTheDocument();
	});
});
