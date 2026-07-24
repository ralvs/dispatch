import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { runTaskReminders } from "@/lib/services/reminders";

const TODAY = "2026-07-14";
const NOW_MS = Date.parse("2026-07-14T18:00:00.000Z"); // 15:00 SP

// Hand-rolled stub mirroring the exact chains runTaskReminders drives:
//   app_settings: select().eq().maybeSingle()           → reminder settings
//   tasks:        select().eq().gte().lte()              → candidates
//   notifications: insert().select().single()            → ledger row
//   tasks:        update().eq()                          → reminders_sent
//
// `events` records call order across tables, so tests can assert the
// insert-then-update ordering guarantee (ADR-0015) per task.
function stubSb(opts: {
	tasks: Array<Record<string, unknown>>;
	settings?: { reminder_offset_minutes: number; reminder_anchor_time: string } | null;
}) {
	const events: string[] = [];
	const notificationInserts: Array<Record<string, unknown>> = [];
	const taskUpdates: Array<{ id: string; patch: Record<string, unknown> }> = [];
	const filters: { eq?: [string, unknown]; gte?: [string, unknown]; lte?: [string, unknown] } = {};

	const sb = {
		from: vi.fn((table: string) => {
			if (table === "app_settings") {
				return {
					select: vi.fn(() => ({
						eq: vi.fn(() => ({
							maybeSingle: vi.fn(async () => ({ data: opts.settings ?? null, error: null })),
						})),
					})),
				};
			}
			if (table === "notifications") {
				return {
					insert: vi.fn((row: Record<string, unknown>) => {
						notificationInserts.push(row);
						events.push(`insert:${row.source_ref}`);
						return {
							select: vi.fn(() => ({
								single: vi.fn(async () => ({
									data: { id: `note-${notificationInserts.length}`, ...row },
									error: null,
								})),
							})),
						};
					}),
				};
			}
			// tasks
			return {
				select: vi.fn(() => ({
					eq: vi.fn((col: string, val: unknown) => {
						filters.eq = [col, val];
						return {
							gte: vi.fn((gcol: string, gval: unknown) => {
								filters.gte = [gcol, gval];
								return {
									lte: vi.fn(async (lcol: string, lval: unknown) => {
										filters.lte = [lcol, lval];
										return { data: opts.tasks, error: null };
									}),
								};
							}),
						};
					}),
				})),
				update: vi.fn((patch: Record<string, unknown>) => ({
					eq: vi.fn(async (_col: string, id: string) => {
						taskUpdates.push({ id, patch });
						events.push(`update:${id}`);
						return { data: null, error: null };
					}),
				})),
			};
		}),
	} as unknown as SupabaseClient;

	return { sb, events, notificationInserts, taskUpdates, filters };
}

describe("runTaskReminders", () => {
	it("selects open tasks in the [today-1, today+3] due_date window", async () => {
		const { sb, filters } = stubSb({ tasks: [] });
		await runTaskReminders(sb, { tz: "America/Sao_Paulo", todayIso: TODAY, nowMs: NOW_MS });

		expect(filters.eq).toEqual(["status", "open"]);
		expect(filters.gte).toEqual(["due_date", "2026-07-13"]);
		expect(filters.lte).toEqual(["due_date", "2026-07-17"]);
	});

	it("writes one notification per fired reminder, with the exact ledger shape", async () => {
		const { sb, notificationInserts } = stubSb({
			tasks: [
				{
					id: "task-1",
					title: "Pay rent",
					due_date: TODAY,
					due_time: "15:00",
					reminders_sent: {},
				},
			],
		});

		const result = await runTaskReminders(sb, {
			tz: "America/Sao_Paulo",
			todayIso: TODAY,
			nowMs: NOW_MS,
		});

		expect(result).toEqual({ scanned: 1, fired: 1, suppressed: 0 });
		expect(notificationInserts).toHaveLength(1);
		expect(notificationInserts[0]).toMatchObject({
			type: "reminder.fired",
			source_ref: "task-1",
			source_url: "/tasks?edit=task-1",
		});
	});

	it("marks reminders_sent AFTER that task's notification insert", async () => {
		const { sb, events } = stubSb({
			tasks: [
				{
					id: "task-1",
					title: "Pay rent",
					due_date: TODAY,
					due_time: "15:00",
					reminders_sent: {},
				},
			],
		});

		await runTaskReminders(sb, { tz: "America/Sao_Paulo", todayIso: TODAY, nowMs: NOW_MS });

		expect(events).toEqual(["insert:task-1", "update:task-1"]);
	});

	it("performs zero writes for an empty plan", async () => {
		const { sb, notificationInserts, taskUpdates } = stubSb({
			tasks: [
				{
					id: "task-1",
					title: "Not due yet",
					due_date: TODAY,
					due_time: "23:00", // well after nowMs
					reminders_sent: {},
				},
			],
		});

		const result = await runTaskReminders(sb, {
			tz: "America/Sao_Paulo",
			todayIso: TODAY,
			nowMs: NOW_MS,
		});

		expect(result).toEqual({ scanned: 1, fired: 0, suppressed: 0 });
		expect(notificationInserts).toEqual([]);
		expect(taskUpdates).toEqual([]);
	});

	it("marks a suppressed (beyond catch-up) reminder sent but sends no notification", async () => {
		const { sb, notificationInserts, taskUpdates } = stubSb({
			tasks: [
				{
					id: "task-1",
					title: "Very overdue",
					due_date: "2026-07-13",
					due_time: "00:00", // 3am SP, far beyond the 2h catch-up window
					reminders_sent: {},
				},
			],
		});

		const result = await runTaskReminders(sb, {
			tz: "America/Sao_Paulo",
			todayIso: TODAY,
			nowMs: NOW_MS,
		});

		expect(result).toEqual({ scanned: 1, fired: 0, suppressed: 1 });
		expect(notificationInserts).toEqual([]);
		expect(taskUpdates).toEqual([
			{ id: "task-1", patch: { reminders_sent: { due: "2026-07-13" } } },
		]);
	});

	it("defaults to {0, 09:00} when the settings row/columns are missing", async () => {
		const { sb } = stubSb({
			tasks: [
				{
					id: "task-1",
					title: "Anchor test",
					due_date: TODAY,
					due_time: null,
					reminders_sent: {},
				},
			],
			settings: null,
		});

		// 09:00 SP == 12:00Z; nowMs here matches that anchor exactly.
		const result = await runTaskReminders(sb, {
			tz: "America/Sao_Paulo",
			todayIso: TODAY,
			nowMs: Date.parse("2026-07-14T12:00:00.000Z"),
		});

		expect(result.fired).toBe(1);
	});
});
