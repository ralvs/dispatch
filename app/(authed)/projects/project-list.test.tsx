import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectAction } from "@/app/(authed)/projects/actions";
import type { ActionResult } from "@/lib/action-result";
import type { ProjectRow } from "@/lib/schemas/project";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { domainItem, NOW, project, snapshot, T1, T2, task } from "@/lib/store/test-fixtures";
import type { StoreWrite } from "@/lib/store/types";
import { getMeasure } from "@/test/component/measure";
import { ProjectList } from "./project-list";

vi.mock("@/app/(authed)/projects/actions", () => ({ createProjectAction: vi.fn() }));
vi.mock("@/app/(authed)/tasks/actions", () => ({ createTaskAction: vi.fn() }));

const DOMAIN_ID = "7f1c0a4e-1111-4000-8000-000000000001";
const home = domainItem({ id: DOMAIN_ID, name: "Home" });
const alpha = project({
	id: "alpha",
	name: "Alpha",
	domain_id: DOMAIN_ID,
	domain: { id: DOMAIN_ID, name: "Home", color: null },
});
const open = task({ id: "t1", title: "Draft plan", project_id: "alpha" });

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
});

function renderList() {
	render(
		<StoreProvider store={store}>
			<Seed
				snapshot={snapshot(T1, [
					{ key: viewKey.projects(), type: "projectList", data: { rows: [alpha] } },
					{
						key: viewKey.projectRowTasks("alpha"),
						type: "taskList",
						data: { rows: [open], scope: { projectId: "alpha" } },
					},
				])}
			>
				<ProjectList domains={[home]} doneAtRead={{ alpha: 2 }} />
			</Seed>
		</StoreProvider>,
	);
}

describe("ProjectList on the entity store", () => {
	it("a new project shows at once, and becomes a link once the server's row lands", async () => {
		let resolve: (r: ActionResult<StoreWrite<ProjectRow>>) => void = () => {};
		vi.mocked(createProjectAction).mockReturnValue(
			new Promise((r) => {
				resolve = r;
			}),
		);
		const user = userEvent.setup();
		renderList();

		await user.click(screen.getByRole("button", { name: "New project" }));
		await user.type(screen.getByLabelText("Project name"), "Beta");
		await user.selectOptions(screen.getByRole("combobox"), DOMAIN_ID);
		await user.click(screen.getByRole("button", { name: "Add project" }));

		expect(getMeasure(2, "active")).toBeInTheDocument();
		expect(screen.getByText("Beta")).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /Beta/ })).toBeNull();

		const beta = project({ ...alpha, id: "beta", name: "Beta" });
		await act(async () => resolve({ ok: true, data: { at: T2, rows: [beta] } }));
		expect(screen.getByRole("link", { name: /Beta/ })).toHaveAttribute("href", "/projects/beta");
	});

	it("a task finished elsewhere leaves the row's list and counts as done", async () => {
		renderList();
		expect(screen.getByText("Home · 2/3 done")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Draft plan" })).toBeInTheDocument();

		// The same task, completed on the project page and confirmed there.
		await act(async () => {
			const token = store
				.getState()
				.apply({ kind: "task", intent: { type: "complete", id: "t1", observedDueDate: null } });
			store.getState().confirm(token, {
				at: T2,
				rows: [{ ...open, status: "done", completed_at: NOW }],
			});
		});
		expect(screen.getByText("Home · 3/3 done")).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: "Draft plan" })).toBeNull();
	});
});
