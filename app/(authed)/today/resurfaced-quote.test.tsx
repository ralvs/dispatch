import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { resetResurfacedAction, skipResurfacedQuoteAction } from "@/app/(authed)/today/actions";
import { quote } from "@/lib/store/test-fixtures";
import { ResurfacedQuote } from "./resurfaced-quote";

vi.mock("@/app/(authed)/today/actions", () => ({
	skipResurfacedQuoteAction: vi.fn(),
	resetResurfacedAction: vi.fn(),
}));

const first = quote({ id: "first", text: "First pick" });
const second = quote({ id: "second", text: "Second pick" });

describe("ResurfacedQuote", () => {
	it("Next shows the pick the server answers with, and Reset goes back, with no page render", async () => {
		vi.mocked(skipResurfacedQuoteAction).mockResolvedValue({
			ok: true,
			data: { quote: second, skips: 1, hasQuotes: true },
		});
		vi.mocked(resetResurfacedAction).mockResolvedValue({
			ok: true,
			data: { quote: first, skips: 0, hasQuotes: true },
		});
		const user = userEvent.setup();
		render(<ResurfacedQuote quote={first} skips={0} hasQuotes />);
		expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();

		await user.click(screen.getByRole("button", { name: "Next →" }));
		expect(skipResurfacedQuoteAction).toHaveBeenCalledWith("first");
		expect(await screen.findByText("“Second pick”")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Reset" }));
		expect(await screen.findByText("“First pick”")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
	});
});
