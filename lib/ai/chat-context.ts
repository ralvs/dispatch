import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { doingTodayFromSchedule } from "@/lib/day-schedule";
import type { DomainRow } from "@/lib/services/domains";
import { listDomains } from "@/lib/services/domains";
import type { JournalEntryRow } from "@/lib/services/journal";
import { listEntries } from "@/lib/services/journal";
import type { NoteListRow } from "@/lib/services/notes";
import { listNotes } from "@/lib/services/notes";
import type { PersonRow } from "@/lib/services/people";
import { listPeople } from "@/lib/services/people";
import type { ProjectRow } from "@/lib/services/projects";
import { listProjects } from "@/lib/services/projects";
import type { QuoteRow } from "@/lib/services/quotes";
import { listQuotes } from "@/lib/services/quotes";
import type { TaskRow } from "@/lib/services/tasks";
import { listTasks } from "@/lib/services/tasks";
import { getToday, type TodayView } from "@/lib/services/today";

// ─────────────────────────────────────────────────────────────────────────
// The read-only snapshot fed to the chat model as its CONTEXT block. The
// fetcher (buildChatSystemPrompt) never throws into the route — each source
// is fetched independently and dropped from the snapshot on failure.
// renderChatContext is the pure, tested half: snapshot in, CONTEXT string
// out, caps enforced here so the render stays honest even if a caller hands
// it an unbounded list.
// ─────────────────────────────────────────────────────────────────────────

const TASK_CAP = 50;
const ENTRY_CAP = 15;
const NOTE_CAP = 15;
const QUOTE_CAP = 15;

export type ChatSnapshot = {
	today?: TodayView;
	tasks?: TaskRow[];
	projects?: ProjectRow[];
	people?: PersonRow[];
	entries?: JournalEntryRow[];
	notes?: NoteListRow[];
	quotes?: QuoteRow[];
	domains?: DomainRow[];
};

const SYSTEM_PROMPT_TEMPLATE = (
	todayIso: string,
	context: string,
) => `You are Dispatch, the personal-operations assistant for Renan (renan@alves.id). You answer
questions about his tasks, projects, notes, journal, quotes, people, routines, and
domains using ONLY the context block below — a live snapshot of his dashboard.

Rules:
1. Answer strictly from the CONTEXT. Never invent tasks, dates, names, quotes, or numbers.
2. If the context doesn't contain the answer, say so plainly and name what's missing. Do not guess.
3. Be concise: 1–3 sentences, add a short bullet list only when it aids clarity.
4. Content is stored verbatim in the language written (PT-BR or EN). Quote it in its original
   language; write your own prose in the language of the user's question.
5. Timezone is America/Sao_Paulo; dates in context are already local calendar dates — refer to
   them naturally ("due today", "Tuesday"). Never do raw timezone math.
6. Attribute sources naturally ("In a journal entry from July 3 you wrote…").
7. Never output raw JSON or the context block verbatim.

CONTEXT (snapshot for ${todayIso}):
${context}`;

/** Turns a snapshot into the CONTEXT block: section headers, caps enforced here. */
export function renderChatContext(snapshot: ChatSnapshot): string {
	const sections: string[] = [];

	if (snapshot.today) {
		const b = snapshot.today;
		const routines =
			b.routines.total > 0
				? `${b.routines.done}/${b.routines.total} done; remaining: ${
						b.routines.remainingNames.length > 0 ? b.routines.remainingNames.join(", ") : "none"
					}`
				: "no active routines";
		const quote = b.quoteOfDay
			? `"${b.quoteOfDay.text}"${b.quoteOfDay.source_author ? ` — ${b.quoteOfDay.source_author}` : ""}`
			: "none";
		sections.push(
			[
				"## Today",
				`Overdue: ${b.anchor.overdueCount}; need review: ${b.needsReviewCount}`,
				`Inbox: ${b.inboxCount} unfiled`,
				`Doing today: ${
					doingTodayFromSchedule(b.daySchedule)
						.map((t) => t.title)
						.join(", ") || "nothing pinned"
				}`,
				`Routines: ${routines}`,
				`Quote of the day: ${quote}`,
			].join("\n"),
		);
	}

	if (snapshot.tasks) {
		const rows = snapshot.tasks.slice(0, TASK_CAP);
		sections.push(
			[
				`## Open tasks (${rows.length})`,
				...rows.map((t) => `- ${t.title}${t.due_date ? ` — due ${t.due_date}` : ""}`),
			].join("\n"),
		);
	}

	if (snapshot.projects) {
		sections.push(
			["## Projects", ...snapshot.projects.map((p) => `- ${p.name} (${p.status})`)].join("\n"),
		);
	}

	if (snapshot.people) {
		sections.push(["## People", ...snapshot.people.map((p) => `- ${p.name}`)].join("\n"));
	}

	if (snapshot.entries) {
		const rows = snapshot.entries.slice(0, ENTRY_CAP);
		sections.push(
			[
				`## Journal entries (${rows.length})`,
				...rows.map((e) => `- ${e.entry_date}: ${(e.transcription_text ?? "").slice(0, 120)}`),
			].join("\n"),
		);
	}

	if (snapshot.notes) {
		const rows = snapshot.notes.slice(0, NOTE_CAP);
		sections.push(
			[
				`## Notes (${rows.length})`,
				...rows.map((n) => `- ${n.title ?? n.body.split("\n")[0]}`),
			].join("\n"),
		);
	}

	if (snapshot.quotes) {
		const rows = snapshot.quotes.slice(0, QUOTE_CAP);
		sections.push(
			[
				`## Quotes (${rows.length})`,
				...rows.map((q) => `- "${q.text}"${q.source_author ? ` — ${q.source_author}` : ""}`),
			].join("\n"),
		);
	}

	if (snapshot.domains) {
		sections.push(
			[
				"## Domains",
				...snapshot.domains.map(
					(d) => `- ${d.name}${d.fruit_definition ? `: ${d.fruit_definition}` : ""}`,
				),
			].join("\n"),
		);
	}

	return sections.join("\n\n");
}

async function safeFetch<T>(fn: () => Promise<T>): Promise<T | undefined> {
	try {
		return await fn();
	} catch {
		return undefined;
	}
}

/** Assembles the live snapshot and renders the full chat system prompt. Never throws. */
export async function buildChatSystemPrompt(
	sb: SupabaseClient,
	tz: string,
	todayIso: string,
): Promise<string> {
	const [today, tasks, projects, people, entries, notes, quotes, domains] = await Promise.all([
		safeFetch(() => getToday(sb, tz, todayIso)),
		safeFetch(() => listTasks(sb, { status: "open" })),
		safeFetch(() => listProjects(sb)),
		safeFetch(() => listPeople(sb)),
		safeFetch(() => listEntries(sb)),
		safeFetch(() => listNotes(sb)),
		safeFetch(() => listQuotes(sb)),
		safeFetch(() => listDomains(sb)),
	]);

	const context = renderChatContext({
		today,
		tasks,
		projects,
		people,
		entries,
		notes,
		quotes,
		domains,
	});

	return SYSTEM_PROMPT_TEMPLATE(todayIso, context);
}
