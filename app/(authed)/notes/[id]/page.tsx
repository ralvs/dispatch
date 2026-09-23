import { X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Button, ListRow, rowTitle, SectionHead } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomains } from "@/lib/cache/domains";
import { getCachedNoteEditorContext, getCachedNoteLinks } from "@/lib/cache/notes";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { formatInstant } from "@/lib/dates";
import { displayTitle } from "@/lib/note-display";
import { getNote } from "@/lib/services/notes";
import { detachLinkAction } from "../actions";
import { AttachmentStrip } from "./attachment-strip";
import { LinkPicker } from "./link-picker";
import { NoteEditor } from "./note-editor";

/*
 * The editor is what you opened the page for, so it waits only on its own two
 * autocomplete reads. The link rail carries the long pole — backlinks and
 * links, then a dependent second wave for the manual targets' labels — and
 * streams in behind its own boundary rather than holding the note hostage.
 */
async function EditorSection({ note }: { note: NonNullable<Awaited<ReturnType<typeof getNote>>> }) {
	const [{ noteTitles, people }, domains] = await Promise.all([
		getCachedNoteEditorContext(),
		getCachedDomains(false),
	]);
	return (
		<NoteEditor
			note={note}
			noteTitles={noteTitles}
			people={people}
			domains={domains.map((d) => ({ id: d.id, name: d.name }))}
		/>
	);
}

/*
 * Content-shaped pulse, deliberately not PageSkeleton. The note page declined
 * PageHeader in Pass 3 (title is content, breadcrumb is the locator), so a
 * skeleton that invents a header would lie. Waiting is not failure and not
 * absence — Pass 5 / B asked this pair and kept the shape.
 */
function EditorFallback() {
	return (
		<div className="measure-prose">
			<span role="status" className="sr-only">
				Loading note
			</span>
			<div className="space-y-3" aria-hidden="true">
				<div className="h-8 w-2/3 rounded bg-surface animate-pulse" />
				<div className="h-4 w-full rounded bg-surface animate-pulse" />
				<div className="h-4 w-11/12 rounded bg-surface animate-pulse" />
				<div className="h-4 w-4/5 rounded bg-surface animate-pulse" />
				<div className="h-4 w-5/6 rounded bg-surface animate-pulse" />
			</div>
		</div>
	);
}

async function LinkSections({ noteId }: { noteId: string }) {
	const [{ backlinks, links, targets }, tz] = await Promise.all([
		getCachedNoteLinks(noteId),
		getCachedAppTimezone(),
	]);

	const manualLinks = links.filter((l) => l.kind === "manual");
	const taskTargets = new Map(targets.tasks.map((t) => [t.id, t]));
	const eventTargets = new Map(targets.events.map((e) => [e.id, e]));

	const linkedRows = manualLinks
		.map((link) => {
			const task =
				link.target_type === "task" && link.target_task_id
					? taskTargets.get(link.target_task_id)
					: null;
			const event =
				link.target_type === "event" && link.target_event_id
					? eventTargets.get(link.target_event_id)
					: null;
			if (!task && !event) return null;
			return { link, task, event };
		})
		.filter((row): row is NonNullable<typeof row> => row !== null);

	return (
		<div className="flex flex-col gap-7">
			{backlinks.length > 0 && (
				<section aria-label="Backlinks">
					<SectionHead title="Linked from" aside={String(backlinks.length)} />
					<ul>
						{backlinks.map((b) => (
							<ListRow key={b.id}>
								<Link
									href={`/notes/${b.note_id}`}
									className={rowTitle({ className: "hover:text-accent-ink" })}
								>
									{displayTitle(b)}
								</Link>
							</ListRow>
						))}
					</ul>
				</section>
			)}

			<section aria-label="Linked items">
				<SectionHead
					title="Linked"
					aside={linkedRows.length > 0 ? String(linkedRows.length) : undefined}
				/>
				{linkedRows.length > 0 && (
					<ul>
						{linkedRows.map(({ link, task, event }) => (
							<ListRow
								key={link.id}
								trailing={
									<form action={detachLinkAction.bind(null, noteId, link.id)}>
										<Button
											type="submit"
											variant="danger-soft"
											size="sm"
											isIconOnly
											aria-label="Remove link"
										>
											<Icon icon={X} size="sm" />
										</Button>
									</form>
								}
							>
								{task ? (
									<Link
										href={`/tasks?edit=${task.id}`}
										className={rowTitle({ className: "hover:text-accent-ink" })}
									>
										{task.title}
										{task.status === "done" ? " · done" : ""}
									</Link>
								) : (
									<div>
										<p className={rowTitle()}>{event?.title}</p>
										<p className="mt-0.5 font-mono text-meta text-ink-4">
											{event ? formatInstant(event.start_at, tz) : ""}
										</p>
									</div>
								)}
							</ListRow>
						))}
					</ul>
				)}
				<LinkPicker noteId={noteId} />
			</section>
		</div>
	);
}

/** Rail twin of EditorFallback — section heads + rows, not a page skeleton. */
function LinkSectionsFallback() {
	return (
		<div className="space-y-6" aria-hidden="true">
			<div className="space-y-2">
				<div className="h-4 w-24 rounded bg-surface animate-pulse" />
				<div className="h-10 w-full rounded bg-surface animate-pulse" />
				<div className="h-10 w-full rounded bg-surface animate-pulse" />
			</div>
			<div className="space-y-2">
				<div className="h-4 w-16 rounded bg-surface animate-pulse" />
				<div className="h-10 w-full rounded bg-surface animate-pulse" />
			</div>
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
	// a 200 and swapping in not-found after the fact. It also stays uncached:
	// the editor autosaves, and every save would bust a cached body at once
	// (lib/cache/notes.ts). The two sections below read through the cache.
	const note = await getNote(sb, parsedId.data);
	if (!note) notFound();

	return (
		<div>
			{/* Breadcrumb is the editor's header — the note title is content
			    (Pass 3; DESIGN.md Page Header exceptions). */}
			<nav aria-label="Breadcrumb" className="pb-4">
				<Link
					href="/notes"
					className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink"
				>
					← Notes
				</Link>
			</nav>

			{/* Column + rail (W2): prose left on the measure, panels right on
			    desk, stack below on phone. One tree. */}
			<div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_16.25rem] lg:items-start lg:gap-10">
				{/* The strip wraps the editor rather than following it: the drop
				    target is the whole note, not a landing pad below it. */}
				<div className="min-w-0">
					<AttachmentStrip noteId={note.id} attachments={note.attachments}>
						<Suspense fallback={<EditorFallback />}>
							<EditorSection note={note} />
						</Suspense>
					</AttachmentStrip>
				</div>
				<aside className="min-w-0 lg:sticky lg:top-0">
					<Suspense fallback={<LinkSectionsFallback />}>
						<LinkSections noteId={note.id} />
					</Suspense>
				</aside>
			</div>
		</div>
	);
}
