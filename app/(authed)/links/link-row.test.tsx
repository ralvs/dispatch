import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LinkRow } from "@/lib/services/links";
import { LinkRowItem } from "./link-row";

vi.mock("@/app/(authed)/links/actions", () => ({ setLinkStatusAction: vi.fn() }));

const URL_WITH_TRACKING = "https://x.com/gregpr07/status/2100411066966749359?s=12&t=vOZAyARm2znI6";

const link = (over: Partial<LinkRow> = {}): LinkRow => ({
	id: "l1",
	url: URL_WITH_TRACKING,
	title: "Gregor Zunic (@gregpr07)",
	description: "Breaking: Browser Use + Jev = Ultrafast",
	image_url: "https://pbs.twimg.com/thumb.jpg",
	status: "unread",
	source: "webhook",
	created_at: "2026-09-17T21:16:00Z",
	updated_at: "2026-09-17T21:16:00Z",
	...over,
});

function renderRow(row: LinkRow) {
	const { container } = render(
		<ul>
			<LinkRowItem link={row} tz="America/Sao_Paulo" />
		</ul>,
	);
	return container;
}

describe("LinkRowItem", () => {
	it("shows the title, the text and the host — not the raw URL or the source", () => {
		renderRow(link());
		expect(screen.getByRole("link", { name: /Gregor Zunic/ })).toHaveAttribute(
			"href",
			URL_WITH_TRACKING,
		);
		expect(screen.getByText("Breaking: Browser Use + Jev = Ultrafast")).toBeInTheDocument();
		expect(screen.getByText("x.com")).toBeInTheDocument();
		expect(screen.queryByText(/status\/2100411066966749359/)).toBeNull();
		expect(screen.queryByText(/webhook/)).toBeNull();
	});

	it("hotlinks the preview without a referrer, and hides it when it fails to load", () => {
		const container = renderRow(link());
		const img = container.querySelector("img");
		expect(img).toHaveAttribute("src", "https://pbs.twimg.com/thumb.jpg");
		expect(img).toHaveAttribute("referrerpolicy", "no-referrer");

		if (img) fireEvent.error(img);
		expect(container.querySelector("img")).toBeNull();
	});

	it("falls back to the host when the link has no title or image", () => {
		const container = renderRow(link({ title: null, description: null, image_url: null }));
		expect(screen.getByRole("link", { name: /x\.com/ })).toBeInTheDocument();
		expect(container.querySelector("img")).toBeNull();
	});
});
