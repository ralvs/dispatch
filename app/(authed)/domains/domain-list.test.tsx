import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { archiveDomainAction } from "@/app/(authed)/domains/actions";
import type { ActionResult } from "@/lib/action-result";
import type { DomainItem } from "@/lib/schemas/domain";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { domainItem, NOW, snapshot, T1, T2 } from "@/lib/store/test-fixtures";
import type { StoreWrite } from "@/lib/store/types";
import { getMeasure } from "@/test/component/measure";
import { DomainList } from "./domain-list";

vi.mock("@/app/(authed)/domains/actions", () => ({
	archiveDomainAction: vi.fn(),
	createDomainAction: vi.fn(),
	markDomainShippedAction: vi.fn(),
	reactivateDomainAction: vi.fn(),
	updateDomainAction: vi.fn(),
}));
vi.mock("@/lib/client/toast", () => ({ toastError: vi.fn() }));

const touch = (domainId: string, quiet: boolean) => ({
	domainId,
	name: domainId,
	lastTouchUtc: null,
	daysSinceTouch: quiet ? 12 : 1,
	thresholdDays: 7,
	openTasks: 0,
	quiet,
});
const health = domainItem({
	id: "health",
	name: "Health",
	cadenceDays: 7,
	touch: touch("health", true),
});
const work = domainItem({ id: "work", name: "Work", cadenceDays: 7, touch: touch("work", false) });

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
});

describe("DomainList on the entity store", () => {
	it("archive moves the domain to Archived and out of the band at once", async () => {
		let resolve: (r: ActionResult<StoreWrite<DomainItem>>) => void = () => {};
		vi.mocked(archiveDomainAction).mockReturnValue(
			new Promise((r) => {
				resolve = r;
			}),
		);
		render(
			<StoreProvider store={store}>
				<Seed
					snapshot={snapshot(T1, [
						{ key: viewKey.domains(), type: "domainList", data: { rows: [health, work] } },
					])}
				>
					<DomainList />
				</Seed>
			</StoreProvider>,
		);
		// The figure sits above its label in one cell.
		const band = () => screen.getByText("gone quiet").parentElement as HTMLElement;
		expect(within(band()).getByText("1")).toBeInTheDocument();

		await userEvent.setup().click(screen.getByRole("button", { name: "Archive Health" }));
		expect(getMeasure(1, "active")).toBeInTheDocument();
		expect(getMeasure(1, "archived")).toBeInTheDocument();
		expect(within(band()).getByText("0")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Reactivate Health" })).toBeInTheDocument();

		const archived = { ...health, active: false, touch: null };
		await act(async () => resolve({ ok: true, data: { at: T2, rows: [archived] } }));
		expect(store.getState().pending).toEqual([]);
		expect(getMeasure(1, "archived")).toBeInTheDocument();
	});
});
