import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readLocalStack } from "../integration/stack";

/**
 * A task opens where you are (#97, docs/adr/0079). A task link is the task's
 * own URL, `/tasks/<id>`: followed inside the app it opens the form over the
 * page it was on; loaded directly it opens over the Tasks board. Either way the
 * dialog appears, whatever the task's place on the board.
 */

const stack = readLocalStack();
const sb = createClient(stack.apiUrl, stack.secretKey, {
	auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = Date.now();
const names = {
	domain: `E2E Open Domain ${stamp}`,
	project: `E2E Open Project ${stamp}`,
	paused: `E2E Open Paused ${stamp}`,
	task: `E2E open task ${stamp}`,
	renamed: `E2E open task renamed ${stamp}`,
	quiet: `E2E quiet task ${stamp}`,
	doomed: `E2E doomed task ${stamp}`,
	board: `E2E board task ${stamp}`,
};
const ids = { domain: "", project: "", paused: "", task: "", quiet: "", doomed: "", board: "" };

async function insert(table: string, row: Record<string, unknown>): Promise<string> {
	const { data, error } = await sb.from(table).insert([row]).select("id").single();
	if (error) throw new Error(`${table}: ${error.message}`);
	return data.id as string;
}

test.beforeAll(async () => {
	ids.domain = await insert("stewardship_domains", { name: names.domain });
	ids.project = await insert("projects", { name: names.project, domain_id: ids.domain });
	ids.paused = await insert("projects", {
		name: names.paused,
		domain_id: ids.domain,
		status: "paused",
	});
	ids.task = await insert("tasks", {
		title: names.task,
		domain_id: ids.domain,
		project_id: ids.project,
	});
	ids.doomed = await insert("tasks", {
		title: names.doomed,
		domain_id: ids.domain,
		project_id: ids.project,
	});
	// Undated, in a paused project: quiet, so not on the board's default view —
	// the case where `?edit=` never opened anything.
	ids.quiet = await insert("tasks", {
		title: names.quiet,
		domain_id: ids.domain,
		project_id: ids.paused,
	});
});

test.afterAll(async () => {
	await sb.from("tasks").delete().in("id", [ids.task, ids.quiet, ids.doomed]);
	await sb.from("tasks").delete().eq("title", names.board);
	await sb.from("projects").delete().in("id", [ids.project, ids.paused]);
	await sb.from("stewardship_domains").delete().eq("id", ids.domain);
});

const editDialog = (page: Page) => page.getByRole("dialog", { name: "Edit task" });
const newDialog = (page: Page) => page.getByRole("dialog", { name: "New task" });

async function openFromProject(page: Page, title: string, id = ids.task) {
	await page.goto(`/projects/${ids.project}`);
	// By address, not name: a write busts the project's cache stale-while-
	// revalidate, so the next load may still draw the old title.
	await page.locator(`a[href="/tasks/${id}"]`).click();
	// The dialog reads the row uncached, so it always has the current one.
	await expect(editDialog(page).getByLabel("Task title")).toHaveValue(title);
	expect(new URL(page.url()).pathname).toBe(`/tasks/${id}`);
	// The project is still the page under the dialog.
	await expect(page.getByRole("heading", { name: names.project, level: 1 })).toBeAttached();
}

test.describe.configure({ mode: "serial" });

test("a task link opens over the page it is on, and Save returns to it", async ({ page }) => {
	await openFromProject(page, names.task);

	await editDialog(page).getByLabel("Task title").fill(names.renamed);
	await editDialog(page).getByRole("button", { name: "Save" }).click();

	await expect(editDialog(page)).toHaveCount(0);
	await page.waitForURL(`**/projects/${ids.project}`);
	await expect(page.getByRole("link", { name: names.renamed, exact: true })).toBeVisible();
	names.task = names.renamed;

	// Open again from the same page: the router replays its older render of
	// the dialog, and the form must still show what was saved.
	await page.locator(`a[href="/tasks/${ids.task}"]`).click();
	await expect(editDialog(page).getByLabel("Task title")).toHaveValue(names.renamed);
});

// Created through the app, not inserted with the service client: /tasks reads
// a cross-request cache that only an app write busts, and the skeleton smoke
// running beside this test may already have filled it (as in tick-flow).
test("on the Tasks board a row opens the same way, over the board", async ({ page }) => {
	await page.goto("/tasks");
	await page.getByRole("button", { name: "New task" }).click();
	await newDialog(page).getByLabel("Task title").fill(names.board);
	await newDialog(page)
		.getByRole("combobox", { name: "Domain" })
		.selectOption({ label: "E2E Domain" });
	await newDialog(page).getByRole("button", { name: "Add task" }).click();
	// The row links to its server id once the create is confirmed.
	await expect
		.poll(async () => {
			const { data } = await sb.from("tasks").select("id").eq("title", names.board);
			ids.board = data?.[0]?.id ?? "";
			return ids.board;
		})
		.not.toBe("");
	await page.locator(`a[href="/tasks/${ids.board}"]`).first().click();
	await expect(editDialog(page).getByLabel("Task title")).toHaveValue(names.board);
	expect(new URL(page.url()).pathname).toBe(`/tasks/${ids.board}`);

	await editDialog(page).getByRole("button", { name: "Cancel" }).click();
	await page.waitForURL(/\/tasks(\?.*)?$/);
	await expect(editDialog(page)).toHaveCount(0);
});

test("Delete removes the task and returns to the page", async ({ page }) => {
	await openFromProject(page, names.doomed, ids.doomed);
	page.once("dialog", (confirm) => confirm.accept());
	await editDialog(page).getByRole("button", { name: "Delete" }).click();

	await page.waitForURL(`**/projects/${ids.project}`);
	await expect(editDialog(page)).toHaveCount(0);
	await expect(page.locator(`a[href="/tasks/${ids.doomed}"]`)).toHaveCount(0);
	await expect
		.poll(async () => (await sb.from("tasks").select("id").eq("id", ids.doomed)).data?.length)
		.toBe(0);
});

test("Back closes the dialog", async ({ page }) => {
	await openFromProject(page, names.task);
	await page.goBack();
	await expect(editDialog(page)).toHaveCount(0);
	expect(new URL(page.url()).pathname).toBe(`/projects/${ids.project}`);
});

test("the nav keeps lighting the page under the dialog", async ({ page }) => {
	await openFromProject(page, names.task);
	// A project lives under More. Lit first, so the nav has its pathname.
	await expect(page.locator("[aria-current]", { hasText: "More" }).first()).toBeAttached();
	await expect(page.locator("[aria-current]", { hasText: "Tasks" })).toHaveCount(0);
});

// Next keeps the page you leave alive, state and all, and shows it again when
// you come back: a dialog that remembered being closed stayed closed.
test("a task closed with Cancel opens again from the same link", async ({ page }) => {
	await openFromProject(page, names.task);
	await editDialog(page).getByRole("button", { name: "Cancel" }).click();
	await page.waitForURL(`**/projects/${ids.project}`);
	await expect(editDialog(page)).toHaveCount(0);

	await page.locator(`a[href="/tasks/${ids.task}"]`).click();
	await expect(editDialog(page).getByLabel("Task title")).toHaveValue(names.task);
});

test("navigating elsewhere closes the dialog", async ({ page }) => {
	await openFromProject(page, names.task);
	// Off the title field: the shortcut stands down inside a text input.
	await editDialog(page).getByRole("button", { name: "Close edit task" }).focus();
	await page.keyboard.press("Alt+Digit1");
	await page.waitForURL("**/today");
	await expect(editDialog(page)).toHaveCount(0);
});

test("loaded by its URL, a quiet task opens over the Tasks board", async ({ page }) => {
	await page.goto(`/tasks/${ids.quiet}`);
	await expect(editDialog(page).getByLabel("Task title")).toHaveValue(names.quiet);
	await expect(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeAttached();
	// The board's filter mirror leaves a task's address alone.
	expect(new URL(page.url()).pathname).toBe(`/tasks/${ids.quiet}`);

	await editDialog(page).getByRole("button", { name: "Cancel" }).click();
	await page.waitForURL(/\/tasks$/);
	await expect(editDialog(page)).toHaveCount(0);
});

test("an unknown task says so instead of hanging", async ({ page }) => {
	await page.goto("/tasks/00000000-0000-4000-8000-000000000000");
	await expect(editDialog(page).getByText("This task no longer exists.")).toBeVisible();
});

test("the old ?edit= address goes to the task's own", async ({ page }) => {
	await page.goto(`/tasks?edit=${ids.quiet}`);
	await page.waitForURL(`**/tasks/${ids.quiet}`);
	await expect(editDialog(page).getByLabel("Task title")).toHaveValue(names.quiet);
});

test("a phone gets the whole screen; a desktop gets the dialog", async ({ page }) => {
	await page.setViewportSize({ width: 393, height: 852 });
	await page.goto(`/tasks/${ids.quiet}`);
	// Measured once the form is in, not while the loading frame stands in.
	await expect(editDialog(page).getByLabel("Task title")).toHaveValue(names.quiet);
	const sheet = await editDialog(page).boundingBox();
	expect(sheet).toMatchObject({ x: 0, y: 0, width: 393, height: 852 });

	await page.setViewportSize({ width: 1280, height: 900 });
	const dialog = await editDialog(page).boundingBox();
	expect(dialog?.width).toBeLessThan(1280);
	expect(dialog?.y).toBeGreaterThan(0);
	// The page behind is blurred, not just dimmed.
	const backdrop = await editDialog(page).evaluate(
		(el) => getComputedStyle(el.parentElement as HTMLElement).backdropFilter,
	);
	expect(backdrop).toMatch(/blur/);
});
