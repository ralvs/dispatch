import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
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

/** Batch-fetches label info for manual link targets — avoids N+1 per row. */
async function loadManualTargets(
	sb: Awaited<ReturnType<typeof requireOwnerPage>>["sb"],
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

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
	const { id: rawId } = await params;
	const parsedId = z.uuid().safeParse(rawId);
	if (!parsedId.success) notFound();

	const { sb } = await requireOwnerPage();
	const [note, noteTitles, backlinks, links, tz, people] = await Promise.all([
		getNote(sb, parsedId.data),
		listNoteTitles(sb),
		listBacklinks(sb, parsedId.data),
		listLinksForNote(sb, parsedId.data),
		getAppTimezone(sb),
		listMentionCandidates(sb),
	]);
	if (!note) notFound();

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
		<div>
			<nav aria-label="Breadcrumb" className="pb-4">
				<Link
					href="/notes"
					className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink"
				>
					← Notes
				</Link>
			</nav>
			<NoteEditor note={note} noteTitles={noteTitles} people={people} />

			{backlinks.length > 0 && (
				<section className="mt-8" aria-label="Backlinks">
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
						Linked from
					</h2>
					<ul className="mt-2">
						{backlinks.map((b) => (
							<li key={b.id} className="border-b border-line">
								<Link href={`/notes/${b.note_id}`} className="block py-2 hover:bg-surface">
									<span className="block truncate font-serif text-sm text-ink">
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
								<li
									key={link.id}
									className="flex items-center justify-between gap-2 border-b border-line py-2"
								>
									{task ? (
										<Link
											href={`/tasks?edit=${task.id}`}
											className="truncate font-serif text-sm text-ink hover:text-accent"
										>
											{task.title}
											{task.status === "done" ? " · done" : ""}
										</Link>
									) : (
										<span className="truncate font-serif text-sm text-ink">
											{event?.title} · {event ? formatInstant(event.start_at, tz) : ""}
										</span>
									)}
									<form action={detachLinkAction.bind(null, note.id, link.id)}>
										<button
											type="submit"
											aria-label="Remove link"
											className="shrink-0 font-mono text-eyebrow text-ink-4 hover:text-accent-slip active:opacity-70"
										>
											×
										</button>
									</form>
								</li>
							);
						})}
					</ul>
				)}
				<LinkPicker noteId={note.id} />
			</section>
		</div>
	);
}
