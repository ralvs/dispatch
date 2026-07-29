import EventKit
import Foundation

// Dispatch Mac calendar bridge (docs/adr/0018).
// Reads calendars already in Apple Calendar via EventKit and POSTs a ±21 day
// snapshot to POST /api/calendar/bridge.
//
// Env:
//   DISPATCH_BASE_URL                 e.g. https://your-app.vercel.app
//   CALENDAR_BRIDGE_SECRET            same secret as Vercel env
//   DISPATCH_BRIDGE_CALENDAR_TITLES   comma-separated Apple Calendar titles
//                                     (required — avoid re-importing iCloud)
//
// Build:
//   cd scripts/mac-calendar-bridge && ./build.sh
// Run once:
//   ./calendar-bridge
// Install launchd (every 15m):
//   ./install-launchd.sh

// Keep in step with CALENDAR_SYNC_WINDOW_MS (lib/constants.ts) — Today's day
// navigation can walk this far back and forward, so the window has to cover it.
let windowDays = 21
let iso = ISO8601DateFormatter()
iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

func isoString(_ date: Date) -> String {
	// Prefer fractional; fall back without if needed.
	if let s = iso.string(for: date) { return s }
	let plain = ISO8601DateFormatter()
	plain.formatOptions = [.withInternetDateTime]
	return plain.string(from: date)
}

func env(_ key: String) -> String? {
	let v = ProcessInfo.processInfo.environment[key]
	if let v, !v.isEmpty { return v }
	return nil
}

func fail(_ message: String, code: Int32 = 1) -> Never {
	fputs("calendar-bridge: \(message)\n", stderr)
	exit(code)
}

struct BridgeEvent: Encodable {
	let uid: String
	let title: String
	let start_at: String
	let end_at: String
	let all_day: Bool
	let location: String?
	let description: String?
	let calendar_name: String
	let etag: String?
}

struct BridgeBody: Encodable {
	let events: [BridgeEvent]
	let window_start: String
	let window_end: String
}

guard let baseURL = env("DISPATCH_BASE_URL") else {
	fail("DISPATCH_BASE_URL is required")
}
guard let secret = env("CALENDAR_BRIDGE_SECRET") else {
	fail("CALENDAR_BRIDGE_SECRET is required")
}
guard let titlesRaw = env("DISPATCH_BRIDGE_CALENDAR_TITLES") else {
	fail("DISPATCH_BRIDGE_CALENDAR_TITLES is required (comma-separated calendar titles)")
}

let allowedTitles = Set(
	titlesRaw
		.split(separator: ",")
		.map { $0.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines) }
		.filter { !$0.isEmpty }
)
if allowedTitles.isEmpty {
	fail("DISPATCH_BRIDGE_CALENDAR_TITLES parsed empty")
}

let store = EKEventStore()
let accessGroup = DispatchGroup()
var accessError: Error?
var accessGranted = false

accessGroup.enter()
if #available(macOS 14.0, *) {
	store.requestFullAccessToEvents { granted, error in
		accessGranted = granted
		accessError = error
		accessGroup.leave()
	}
} else {
	store.requestAccess(to: .event) { granted, error in
		accessGranted = granted
		accessError = error
		accessGroup.leave()
	}
}
accessGroup.wait()

if let accessError {
	fail("EventKit access error: \(accessError.localizedDescription)")
}
if !accessGranted {
	fail("Calendar access denied. Grant Full Calendar access in System Settings → Privacy & Security → Calendars.")
}

let now = Date()
let windowStart = Calendar.current.date(byAdding: .day, value: -windowDays, to: now)!
let windowEnd = Calendar.current.date(byAdding: .day, value: windowDays, to: now)!

let allCalendars = store.calendars(for: .event)
let matched = allCalendars.filter { allowedTitles.contains($0.title) }

if matched.isEmpty {
	let available = allCalendars.map(\.title).sorted().joined(separator: ", ")
	fail(
		"No calendars match DISPATCH_BRIDGE_CALENDAR_TITLES=\(titlesRaw). Available: \(available)"
	)
}

let predicate = store.predicateForEvents(withStart: windowStart, end: windowEnd, calendars: matched)
let ekEvents = store.events(matching: predicate)

var events: [BridgeEvent] = []
events.reserveCapacity(ekEvents.count)

for ek in ekEvents {
	guard let calendar = ek.calendar else { continue }
	// Prefer stable external identifier when present (Google-backed calendars).
	let baseUid = ek.calendarItemExternalIdentifier ?? ek.eventIdentifier ?? ek.calendarItemIdentifier
	// Every occurrence of a recurring series carries the SAME external
	// identifier, and identity upstream is (source, caldav_uid) — so sending it
	// bare collapses the series onto one row: each 15m sync rewrites that row's
	// start to the last occurrence in the ±21d window, and the occurrences that
	// already happened vanish from the day. Qualify by occurrence start instead
	// (EventKit keeps occurrenceDate pinned to the original slot even when a
	// single occurrence is later moved, so the row survives a reschedule).
	// Detached occurrences already carry their own /RID= identifier.
	let uid: String
	if ek.hasRecurrenceRules, !baseUid.contains("/RID="),
		let occurrence: Date = ek.occurrenceDate ?? ek.startDate
	{
		uid = "\(baseUid)/OCC=\(Int(occurrence.timeIntervalSince1970))"
	} else {
		uid = baseUid
	}
	let rawTitle = ek.title?.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines) ?? ""
	let title = rawTitle.isEmpty ? "(no title)" : rawTitle
	let etag: String?
	if let modified = ek.lastModifiedDate {
		etag = isoString(modified)
	} else {
		etag = nil
	}
	events.append(
		BridgeEvent(
			uid: uid,
			title: title,
			start_at: isoString(ek.startDate),
			end_at: isoString(ek.endDate),
			all_day: ek.isAllDay,
			location: ek.location,
			description: ek.notes,
			calendar_name: calendar.title,
			etag: etag
		)
	)
}

let body = BridgeBody(
	events: events,
	window_start: isoString(windowStart),
	window_end: isoString(windowEnd)
)

let encoder = JSONEncoder()
guard let jsonData = try? encoder.encode(body) else {
	fail("Failed to encode JSON body")
}

guard let url = URL(string: baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/api/calendar/bridge")
else {
	fail("Invalid DISPATCH_BASE_URL")
}

var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("Bearer \(secret)", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.httpBody = jsonData
request.timeoutInterval = 60

let sem = DispatchSemaphore(value: 0)
var httpStatus = 0
var responseBody = Data()
var transportError: Error?

URLSession.shared.dataTask(with: request) { data, response, error in
	transportError = error
	if let http = response as? HTTPURLResponse {
		httpStatus = http.statusCode
	}
	responseBody = data ?? Data()
	sem.signal()
}.resume()
sem.wait()

if let transportError {
	fail("HTTP transport error: \(transportError.localizedDescription)")
}

let bodyText = String(data: responseBody, encoding: .utf8) ?? ""
if httpStatus < 200 || httpStatus >= 300 {
	fail("HTTP \(httpStatus): \(bodyText.prefix(400))", code: 2)
}

fputs(
	"calendar-bridge: ok calendars=\(matched.count) events=\(events.count) response=\(bodyText)\n",
	stderr
)
exit(0)
