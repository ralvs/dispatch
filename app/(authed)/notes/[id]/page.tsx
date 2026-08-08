import { X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Icon } from "@/components/ui/icon";
import { requireOwnerPage } from "@/lib/auth";
import { formatInstant } from "@/lib/dates";
import { displayTitle } from "@/lib/note-display";
import { unwrap } from "@/lib/services/errors";
import { listBacklinks, listLinksForNote } from "@/lib/services/note-links";
import { getNote, listNoteTitles } from "@/lib/services/notes";
import { listMentionCandidates } from "@/lib/services/people";
import { getAppTimezone } from "@/lib/services/settings";
import { detachLinkAction } from "../actions";
import { LinkPicker } from "./link-picker";
import { NoteEditor } from "./note-editor";

type TaskTargetInfo = { id: string; title: string; status: "open" | "done" };
type EventTargetInfo = { id: string; title: string; start_at: string };

type Sb = Awaited<ReturnType<typeof requireOwnerPage>>["sb"];

/** Batch-fetches label info for manual link targets — avoids N+1 per row. */
async function loadManualTargets(
	sb: Sb,
	taskIds: string[],
	eventIds: string[],
): Promise<{ tasks: Map<string, TaskTargetInfo>; events: Map<string, EventTargetInfo> }> {
	const [taskRows, eventRows] = await Promise.all([
		taskIds.length > 0
			? unwrap(await sb.from("tasks").select("id, title, status").in("id", taskIds))
			: Promise.resolve([]),
		eventIds.length > 0
			? unwrap(await sb.from("calendar_events").select("id, title, start_at").in("id", eventIds))
			: Promise.resolve([]),
	]);
	return {
		tasks: new Map((taskRows as TaskTargetInfo[]).map((t) => [t.id, t])),
		events: new Map((eventRows as EventTargetInfo[]).map((e) => [e.id, e])),
	};
}

/*
 * The editor is what you opened the page for, so it waits only on its own two
 * autocomplete reads. The link panels below carry the long pole — backlinks and
 * links, then a dependent second wave for the manual targets' labels — and
 * stream in behind their own boundary rather than holding the note hostage.
 */
async function EditorSection({
	sb,
	note,
}: {
	sb: Sb;
	note: NonNullable<Awaited<ReturnType<typeof getNote>>>;
}) {
	const [noteTitles, people] = await Promise.all([listNoteTitles(sb), listMentionCandidates(sb)]);
	return <NoteEditor note={note} noteTitles={noteTitles} people={people} />;
}

function EditorFallback() {
	return (
		<div className="mt-4">
			<span role="status" className="sr-only">
				Loading note
			</span>
			<div className="space-y-3" aria-hidden="true">
				<div className="h-7 w-2/3 rounded bg-surface animate-pulse" />
				<div className="h-4 w-full rounded bg-surface animate-pulse" />
				<div className="h-4 w-11/12 rounded bg-surface animate-pulse" />
				<div className="h-4 w-4/5 rounded bg-surface animate-pulse" />
			</div>
		</div>
	);
}

async function LinkSections({ sb, noteId }: { sb: Sb; noteId: string }) {
	const [backlinks, links, tz] = await Promise.all([
		listBacklinks(sb, noteId),
		listLinksForNote(sb, noteId),
		getAppTimezone(sb),
	]);

	const manualLinks = links.filter((l) => l.kind === "manual");
	const taskIds = manualLinks
		.filter((l) => l.target_type === "task" && l.target_task_id)
		.map((l) => l.target_task_id as string);
	const eventIds = manualLinks
		.filter((l) => l.target_type === "event" && l.target_event_id)
		.map((l) => l.target_event_id as string);
	const { tasks: taskTargets, events: eventTargets } = await loadManualTargets(
		sb,
		taskIds,
		eventIds,
	);

	return (
		<>
			{backlinks.length > 0 && (
				<section className="mt-8" aria-label="Backlinks">
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
						Linked from
					</h2>
					<ul className="mt-2">
						{backlinks.map((b) => (
							<li key={b.id} className="hairline">
								<Link href={`/notes/${b.note_id}`} className="block py-2 hover:bg-surface">
									<span className="block truncate type-title text-sm text-ink">
										{displayTitle(b)}
									</span>
								</Link>
							</li>
						))}
					</ul>
				</section>
			)}

			<section className="mt-8" aria-label="Linked items">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">Linked</h2>
				{manualLinks.length > 0 && (
					<ul className="mt-2">
						{manualLinks.map((link) => {
							const task =
								link.target_type === "task" && link.target_task_id
									? taskTargets.get(link.target_task_id)
									: null;
							const event =
								link.target_type === "event" && link.target_event_id
									? eventTargets.get(link.target_event_id)
									: null;
							if (!task && !event) return null;
							return (
								<li key={link.id} className="flex items-center justify-between gap-2 hairline py-2">
									{task ? (
										<Link
											href={`/tasks?edit=${task.id}`}
											className="truncate type-title text-sm text-ink hover:text-accent"
										>
											{task.title}
											{task.status === "done" ? " · done" : ""}
										</Link>
									) : (
										<span className="truncate type-title text-sm text-ink">
											{event?.title} · {event ? formatInstant(event.start_at, tz) : ""}
										</span>
									)}
									<form action={detachLinkAction.bind(null, noteId, link.id)}>
										<button
											type="submit"
											aria-label="Remove link"
											className="inline-flex shrink-0 text-ink-4 hover:text-accent-slip active:opacity-70"
										>
											<Icon icon={X} size="sm" />
										</button>
									</form>
								</li>
							);
						})}
					</ul>
				)}
				<LinkPicker noteId={noteId} />
			</section>
		</>
	);
}

function LinkSectionsFallback() {
	return (
		<div className="mt-8 space-y-2" aria-hidden="true">
			<div className="h-3 w-20 rounded bg-surface animate-pulse" />
			<div className="h-8 w-full rounded bg-surface animate-pulse" />
		</div>
	);
}

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
	const { id: rawId } = await params;
	const parsedId = z.uuid().safeParse(rawId);
	if (!parsedId.success) notFound();

	const { sb } = await requireOwnerPage();
	// The note itself stays awaited here: it is one query, and it is what decides
	// between this page and a 404 — streaming that decision would mean sending
	// a 200 and swapping in not-found after the fact.
	const note = await getNote(sb, parsedId.data);
	if (!note) notFound();

	return (
		<div>
			<nav aria-label="Breadcrumb" className="pb-4">
				<Link
					href="/notes"
					className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink"
				>
					← Notes
				</Link>
			</nav>

			<Suspense fallback={<EditorFallback />}>
				<EditorSection sb={sb} note={note} />
			</Suspense>

			<Suspense fallback={<LinkSectionsFallback />}>
				<LinkSections sb={sb} noteId={note.id} />
			</Suspense>
		</div>
	);
}
