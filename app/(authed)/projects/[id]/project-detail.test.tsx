import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateProjectAction } from "@/app/(authed)/projects/[id]/actions";
import { toastError } from "@/lib/client/toast";
import type { DomainRow } from "@/lib/services/domains";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { domainItem, NOW, project, snapshot, T1, T2, TODAY } from "@/lib/store/test-fixtures";
import { ProjectDetail } from "./project-detail";

vi.mock("@/app/(authed)/projects/[id]/actions", () => ({
	archiveProjectAction: vi.fn(),
	completeProjectAction: vi.fn(),
	updateProjectAction: vi.fn(),
}));
vi.mock("@/lib/actions/tasks", () => ({ createTaskAction: vi.fn() }));
vi.mock("@/lib/client/toast", () => ({ toastError: vi.fn() }));

const roof = project({ id: "roof", name: "Roof" });
const domains = [domainItem({ id: "domain-1", name: "Home" })] as unknown as DomainRow[];
const refused = { ok: false as const, fieldErrors: { name: ["Name is taken"] } };

let store: DispatchStore;
beforeEach(() => {
	vi.clearAllMocks();
	store = createDispatchStore({ now: () => NOW });
});

function renderDetail() {
	render(
		<StoreProvider store={store}>
			<Seed
				snapshot={snapshot(T1, [
					{
						key: viewKey.projectHead("roof"),
						type: "projectList",
						data: { rows: [roof], scope: { id: "roof" } },
					},
					{
						key: viewKey.project("roof"),
						type: "taskList",
						data: { rows: [], scope: { projectId: "roof" } },
					},
				])}
			>
				<ProjectDetail projectId="roof" projects={[]} domains={domains} todayIso={TODAY} />
			</Seed>
		</StoreProvider>,
	);
}

describe("ProjectDetail inline edit", () => {
	it("a refused edit shows the field error inline, a good one clears it", async () => {
		const user = userEvent.setup();
		vi.mocked(updateProjectAction).mockResolvedValueOnce(refused);
		renderDetail();
		await user.click(screen.getByRole("button", { name: "Edit Roof" }));
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect(await screen.findByText("Name is taken")).toBeInTheDocument();
		expect(toastError).not.toHaveBeenCalled();

		// Editing the field again clears its error.
		fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
			target: { value: "Attic" },
		});
		expect(screen.queryByText("Name is taken")).not.toBeInTheDocument();

		vi.mocked(updateProjectAction).mockResolvedValueOnce(refused);
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect(await screen.findByText("Name is taken")).toBeInTheDocument();

		vi.mocked(updateProjectAction).mockResolvedValueOnce({
			ok: true,
			data: { at: T2, rows: [{ ...roof, name: "Attic" }] },
		});
		await user.click(screen.getByRole("button", { name: "Save" }));
		await user.click(await screen.findByRole("button", { name: "Edit Attic" }));
		expect(screen.queryByText("Name is taken")).not.toBeInTheDocument();
	});
});
