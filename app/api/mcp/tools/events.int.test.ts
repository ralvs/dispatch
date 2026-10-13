import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaldavConnection } from "@/lib/caldav/client";

// Cache invalidation needs a Next request scope; there is none in a test.
vi.mock("@/lib/invalidate", async (original) => ({
	...(await original<typeof import("@/lib/invalidate")>()),
	afterExternalMutation: vi.fn(),
}));
vi.mock("@/lib/env", async (original) => {
	const actual = await original<typeof import("@/lib/env")>();
	return {
		...actual,
		env: () => ({ ...actual.env(), ICLOUD_CALENDAR_NAME: "Renan" }),
		isCaldavConfigured: () => true,
	};
});
// iCloud is the external edge: every test hands the tools its own fake.
const caldav = vi.hoisted(() => ({ conn: null as CaldavConnection | null }));
vi.mock("@/lib/caldav/client", async (original) => ({
	...(await original<typeof import("@/lib/caldav/client")>()),
	createCaldavClient: async () => {
		if (!caldav.conn) throw new Error("no fake CalDAV connection");
		return caldav.conn;
	},
}));

import { POST } from "@/app/api/mcp/route";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/invalidate";
import type { CalendarEventSource } from "@/lib/schemas/calendar";
import { ServiceError } from "@/lib/services/errors";
import { ownerClient, serviceClient } from "@/test/integration/clients";

// The event tools through POST /api/mcp, as the owner, against the local
// database (docs/adr/0079). The app timezone is the seeded America/Sao_Paulo,
// three hours behind UTC.

let nextId = 1;
async function call(name: string, args: unknown) {
	const { data } = await (await ownerClient()).auth.getSession();
	if (!data.session) throw new Error("owner has no session");
	const res = await POST(
		new Request("http://localhost/api/mcp", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
				authorization: `Bearer ${data.session.access_token}`,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: nextId++,
				method: "tools/call",
				params: { name, arguments: args },
			}),
		}),
	);
	expect(res.status).toBe(200);
	const body = await res.text();
	const line = res.headers.get("content-type")?.includes("text/event-stream")
		? (body.split("\n").find((l) => l.startsWith("data: ")) ?? "").slice("data: ".length)
		: body;
	const result = JSON.parse(line).result as { content: { text: string }[]; isError?: boolean };
	return {
		isError: Boolean(result.isError),
		text: result.content[0].text,
		json: () => JSON.parse(result.content[0].text),
	};
}

const RENAN_URL = "https://cal/renan";
const HREF = `${RENAN_URL}/r-1.ics`;
const RENAN_ICS = [
	"BEGIN:VCALENDAR",
	"VERSION:2.0",
	"BEGIN:VEVENT",
	"UID:r-1",
	"DTSTAMP:20260701T000000Z",
	"DTSTART:20260716T140000Z",
	"DTEND:20260716T150000Z",
	"SUMMARY:Dentist",
	"END:VEVENT",
	"END:VCALENDAR",
].join("\r\n");

function fakeConn(overrides: Partial<CaldavConnection> = {}): CaldavConnection {
	return {
		listCalendars: vi.fn(async () => [{ displayName: "Renan", url: RENAN_URL }]),
		fetchObjectsInWindow: vi.fn(async () => []),
		fetchObject: vi.fn(async () => ({ href: HREF, etag: '"etag-1"', data: RENAN_ICS })),
		createObject: vi.fn(async (url: string, name: string) => ({
			href: `${url}/${name}`,
			etag: '"etag-created"',
		})),
		updateObject: vi.fn(async (href: string) => ({ href, etag: '"etag-2"' })),
		deleteObject: vi.fn(async () => undefined),
		...overrides,
	};
}

beforeEach(() => {
	caldav.conn = fakeConn();
	vi.mocked(afterExternalMutation).mockClear();
});

type Seeded = {
	title: string;
	start_at: string;
	end_at: string;
	calendar_name?: string;
	source?: CalendarEventSource;
	all_day?: boolean;
	recurring?: boolean | null;
	description?: string;
	attendees?: string[];
	caldav_uid?: string;
	caldav_href?: string;
	caldav_etag?: string;
};

async function insertEvent(row: Seeded): Promise<string> {
	const { data, error } = await serviceClient()
		.from("calendar_events")
		.insert({
			calendar_name: "Renan",
			source: "caldav",
			recurring: false,
			caldav_uid: `${row.title}-uid`,
			synced_at: "2026-07-01T00:00:00Z",
			...row,
		})
		.select("id")
		.single();
	if (error) throw error;
	return data.id as string;
}

/** The Renan event the fake iCloud holds as RENAN_ICS. */
function insertDentist(overrides: Partial<Seeded> = {}) {
	return insertEvent({
		title: "Dentist",
		start_at: "2026-07-16T14:00:00Z",
		end_at: "2026-07-16T15:00:00Z",
		caldav_uid: "r-1",
		caldav_href: HREF,
		caldav_etag: '"etag-1"',
		...overrides,
	});
}

async function ledger(type: string) {
	const { data } = await serviceClient()
		.from("notifications")
		.select("type, source_ref, undo_payload")
		.eq("type", type);
	return data ?? [];
}

async function rows() {
	const { data } = await serviceClient()
		.from("calendar_events")
		.select("title, source, calendar_name, start_at, end_at");
	return data ?? [];
}

describe("MCP event tools: read", () => {
	it("list_events shows each day's events in local time, with what may be edited", async () => {
		await insertDentist();
		await insertEvent({
			title: "Standup",
			source: "google",
			calendar_name: "Work",
			start_at: "2026-07-17T12:00:00Z",
			end_at: "2026-07-17T12:30:00Z",
		});
		await insertEvent({
			title: "Family dinner",
			calendar_name: "Home",
			start_at: "2026-07-17T22:00:00Z",
			end_at: "2026-07-17T23:30:00Z",
		});
		await insertEvent({
			title: "Holiday",
			all_day: true,
			start_at: "2026-07-18T00:00:00Z",
			end_at: "2026-07-19T00:00:00Z",
		});
		await insertEvent({
			title: "Later",
			start_at: "2026-07-25T14:00:00Z",
			end_at: "2026-07-25T15:00:00Z",
		});

		const result = await call("list_events", { start_date: "2026-07-16", end_date: "2026-07-18" });
		expect(result.isError).toBe(false);
		const { timezone, events } = result.json();
		expect(timezone).toBe("America/Sao_Paulo");
		expect(events).toEqual([
			expect.objectContaining({
				title: "Dentist",
				start: "2026-07-16T11:00",
				end: "2026-07-16T12:00",
				calendar: "Renan",
				source: "caldav",
				editable: true,
			}),
			expect.objectContaining({ title: "Standup", source: "google", editable: false }),
			expect.objectContaining({ title: "Family dinner", calendar: "Home", editable: false }),
			expect.objectContaining({
				title: "Holiday",
				all_day: true,
				start: "2026-07-18",
				end: "2026-07-18",
			}),
		]);

		const home = await call("list_events", {
			start_date: "2026-07-16",
			end_date: "2026-07-18",
			calendar: "home",
		});
		expect(home.json().events.map((e: { title: string }) => e.title)).toEqual(["Family dinner"]);
	});

	it("list_events refuses a backwards or too-long range", async () => {
		const backwards = await call("list_events", {
			start_date: "2026-07-18",
			end_date: "2026-07-16",
		});
		expect(backwards).toMatchObject({ isError: true, text: "end_date is before start_date." });
		const long = await call("list_events", { start_date: "2026-07-01", end_date: "2026-09-30" });
		expect(long.isError).toBe(true);
	});

	it("get_event gives description and attendees, and why it cannot be edited", async () => {
		const id = await insertEvent({
			title: "Planning",
			source: "google",
			calendar_name: "Work",
			start_at: "2026-07-16T13:00:00Z",
			end_at: "2026-07-16T14:00:00Z",
			description: "Q3 goals",
			attendees: ["ana@example.com"],
		});

		expect((await call("get_event", { id })).json()).toMatchObject({
			title: "Planning",
			description: "Q3 goals",
			attendees: ["ana@example.com"],
			editable: false,
			not_editable_because: expect.stringMatching(/work event/),
		});
		const missing = await call("get_event", { id: crypto.randomUUID() });
		expect(missing).toMatchObject({ isError: true, text: "No event with that id." });
	});
});

describe("MCP event tools: write", () => {
	it("create_event writes to the Renan calendar from local time, and to the ledger", async () => {
		const result = await call("create_event", {
			title: "Lunch with Ana",
			start: "2026-07-20T12:30",
			end: "2026-07-20T13:30",
			location: "Rua A, 10",
		});

		expect(result.isError).toBe(false);
		const event = result.json();
		expect(event).toMatchObject({
			title: "Lunch with Ana",
			start: "2026-07-20T12:30",
			end: "2026-07-20T13:30",
			calendar: "Renan",
			source: "created_here",
			editable: true,
		});
		expect(caldav.conn?.createObject).toHaveBeenCalledWith(
			RENAN_URL,
			expect.stringMatching(/\.ics$/),
			expect.stringContaining("DTSTART:20260720T153000Z"),
		);
		expect(await ledger("mcp.event.created")).toEqual([
			{
				type: "mcp.event.created",
				source_ref: event.id,
				undo_payload: { table: "calendar_events", id: event.id },
			},
		]);
		expect(afterExternalMutation).toHaveBeenCalledWith(...EXTERNAL_WRITES.mcpEvents);
	});

	it("create_event refuses an end before the start without reaching iCloud", async () => {
		const result = await call("create_event", {
			title: "Backwards",
			start: "2026-07-20T12:30",
			end: "2026-07-20T11:30",
		});
		expect(result).toMatchObject({ isError: true, text: "end must be after start." });
		expect(caldav.conn?.createObject).not.toHaveBeenCalled();
	});

	it("update_event moves an event by local time and records what undo needs", async () => {
		const id = await insertDentist();

		const result = await call("update_event", {
			id,
			title: "Dentist, moved",
			start: "2026-07-17T09:00",
		});

		expect(result.isError).toBe(false);
		expect(result.json()).toMatchObject({
			title: "Dentist, moved",
			start: "2026-07-17T09:00",
			end: "2026-07-17T10:00",
		});
		expect(caldav.conn?.updateObject).toHaveBeenCalledWith(HREF, expect.any(String), '"etag-1"');
		expect(await ledger("mcp.event.updated")).toEqual([
			{
				type: "mcp.event.updated",
				source_ref: id,
				undo_payload: {
					table: "calendar_events",
					id,
					prev: {
						title: "Dentist",
						start_at: "2026-07-16T14:00:00+00:00",
						end_at: "2026-07-16T15:00:00+00:00",
					},
				},
			},
		]);
		expect(afterExternalMutation).toHaveBeenCalledWith(...EXTERNAL_WRITES.mcpEvents);
	});

	it.each([
		["a work event", { source: "google" as const, calendar_name: "Work" }, /work event/],
		["an event on another calendar", { calendar_name: "Home" }, /"Home" calendar/],
		["a repeating event", { recurring: true }, /repeats/],
	])(
		"update_event and delete_event refuse %s by name, without reaching iCloud",
		async (_label, overrides, reason) => {
			const id = await insertDentist(overrides);

			const update = await call("update_event", { id, title: "x" });
			const del = await call("delete_event", { id });

			expect(update.isError).toBe(true);
			expect(update.text).toMatch(reason);
			expect(del.isError).toBe(true);
			expect(del.text).toMatch(reason);
			expect(caldav.conn?.fetchObject).not.toHaveBeenCalled();
			expect(await rows()).toHaveLength(1);
			expect(await ledger("mcp.event.updated")).toEqual([]);
			expect(await ledger("mcp.event.deleted")).toEqual([]);
		},
	);

	it("update_event refuses an end before the start without reaching iCloud", async () => {
		const id = await insertDentist();

		const result = await call("update_event", { id, end: "2026-07-16T10:00" });

		expect(result).toMatchObject({ isError: true, text: "end must be after start." });
		expect(caldav.conn?.fetchObject).not.toHaveBeenCalled();
		expect(await ledger("mcp.event.updated")).toEqual([]);
	});

	it("refuses a series the row does not know about yet, from the live iCloud copy", async () => {
		const id = await insertDentist({ recurring: null });
		const series = RENAN_ICS.replace("SUMMARY:Dentist", "SUMMARY:Dentist\r\nRRULE:FREQ=WEEKLY");
		caldav.conn = fakeConn({
			fetchObject: vi.fn(async () => ({ href: HREF, etag: '"etag-1"', data: series })),
		});

		const update = await call("update_event", { id, title: "x" });
		const del = await call("delete_event", { id });

		expect(update.text).toMatch(/repeats/);
		expect(del.text).toMatch(/repeats/);
		expect(caldav.conn?.updateObject).not.toHaveBeenCalled();
		expect(caldav.conn?.deleteObject).not.toHaveBeenCalled();
		expect(await rows()).toHaveLength(1);
		expect(await ledger("mcp.event.updated")).toEqual([]);
		expect(await ledger("mcp.event.deleted")).toEqual([]);
	});

	it("update_event answers a change made in iCloud since the last sync with the reason", async () => {
		const id = await insertDentist();
		caldav.conn = fakeConn({
			fetchObject: vi.fn(async () => ({ href: HREF, etag: '"etag-9"', data: RENAN_ICS })),
		});

		const result = await call("update_event", { id, title: "x" });

		expect(result.isError).toBe(true);
		expect(result.text).toMatch(/changed in iCloud since the last sync/);
		expect(caldav.conn?.updateObject).not.toHaveBeenCalled();
		expect(await rows()).toEqual([expect.objectContaining({ title: "Dentist" })]);
		expect(await ledger("mcp.event.updated")).toEqual([]);
	});

	it("delete_event deletes in iCloud and here, and keeps the whole event for undo", async () => {
		const id = await insertDentist({ description: "Bring the card" });

		const result = await call("delete_event", { id });

		expect(result.json()).toEqual({ deleted: true, id, title: "Dentist" });
		expect(caldav.conn?.deleteObject).toHaveBeenCalledWith(HREF, '"etag-1"');
		expect(await rows()).toEqual([]);
		expect(await ledger("mcp.event.deleted")).toEqual([
			{
				type: "mcp.event.deleted",
				source_ref: id,
				undo_payload: {
					table: "calendar_events",
					id,
					event: expect.objectContaining({
						id,
						title: "Dentist",
						description: "Bring the card",
						start_at: "2026-07-16T14:00:00+00:00",
						calendar_name: "Renan",
					}),
				},
			},
		]);
		expect(afterExternalMutation).toHaveBeenCalledWith(...EXTERNAL_WRITES.mcpEvents);
	});

	it("delete_event keeps the event when iCloud refuses", async () => {
		const id = await insertDentist();
		caldav.conn = fakeConn({
			deleteObject: vi.fn(async () => {
				throw new ServiceError("iCloud refused to delete the event (HTTP 500)", null);
			}),
		});

		const result = await call("delete_event", { id });

		expect(result.isError).toBe(true);
		expect(await rows()).toHaveLength(1);
		expect(await ledger("mcp.event.deleted")).toEqual([]);
	});
});
