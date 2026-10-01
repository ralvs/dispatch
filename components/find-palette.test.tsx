import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openFindPalette } from "@/lib/find/palette-bus";
import type { FindResult } from "@/lib/services/find";
import { FindPalette } from "./find-palette";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Each query's response is held until the test resolves it, so the order the
// server answers in is under the test's control.
const pending = new Map<string, (result: FindResult) => void>();
const findAction = vi.fn(
	(query: string) =>
		new Promise<FindResult>((resolve) => {
			pending.set(query, resolve);
		}),
);
vi.mock("@/app/(authed)/find/actions", () => ({
	findAction: (query: string) => findAction(query),
}));

function resultFor(query: string, title: string): FindResult {
	return {
		query,
		recents: false,
		tasks: [
			{
				kind: "task",
				id: title,
				title,
				status: "open",
				field: "title",
				snippet: null,
				href: `/tasks/${title}`,
			},
		],
		notes: [],
	};
}

describe("FindPalette", () => {
	beforeEach(() => {
		pending.clear();
		findAction.mockClear();
	});

	it("shows results for the latest query only", async () => {
		const user = userEvent.setup();
		render(<FindPalette />);
		act(() => openFindPalette());
		const input = await screen.findByRole("textbox", { name: "Find" });

		await user.type(input, "a");
		await waitFor(() => expect(pending.has("a")).toBe(true));
		await user.type(input, "b");
		await waitFor(() => expect(pending.has("ab")).toBe(true));

		await act(async () => pending.get("ab")?.(resultFor("ab", "Newer hit")));
		await act(async () => pending.get("a")?.(resultFor("a", "Older hit")));

		expect(await screen.findByText("Newer hit")).toBeTruthy();
		expect(screen.queryByText("Older hit")).toBeNull();
	});
});
