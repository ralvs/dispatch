import { X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { z } from "zod";
import {
	BackLink,
	Button,
	ListRow,
	PillBone,
	rowTitle,
	SectionHead,
	TextBone,
} from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomains } from "@/lib/cache/domains";
import { getCachedNoteEditorContext, getCachedNoteLinks } from "@/lib/cache/notes";
import { getCachedAppTimezone, readClock } from "@/lib/cache/settings";
import { formatInstant } from "@/lib/dates";
import { displayTitle } from "@/lib/note-display";
import { getNote } from "@/lib/services/notes";
import { Seed } from "@/lib/store/seed";
import { seedOf, stampRead } from "@/lib/store/server";
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
 * Content-shaped bones, deliberately not PageSkeleton. The note page declined
 * PageHeader in Pass 3 (title is content, breadcrumb is the locator), so a
 * skeleton that invents a header would lie. This is NoteEditor's own frame:
 * the title field on its rule, the prose, the min-h-64 body, the meta line and
 * the DELETE pill.
 */
function EditorFallback() {
	return (
		<div className="measure-prose">
			<span role="status" className="sr-only">
				Loading note
			</span>
			<div aria-hidden="true">
				<div className="border-b border-line py-1">
					<TextBone className="text-t30" width="w-2/3" />
				</div>
				<div className="mt-7 min-h-64 border-b border-line pb-2 text-base leading-[1.6]">
					<TextBone width="w-full" />
					<TextBone width="w-11/12" />
					<TextBone width="w-4/5" />
					<TextBone width="w-5/6" />
				</div>
				<TextBone className="mt-3 font-mono text-meta" width="w-40" />
				<div className="mt-4 flex gap-2">
					<PillBone width="w-[72px]" />
				</div>
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

/** Rail twin of EditorFallback: the Linked head over its two link pills. */
function LinkSectionsFallback() {
	return (
		<section aria-hidden="true">
			<div className="mb-1.5 flex items-baseline gap-2">
				<TextBone className="type-section" width="w-16" />
			</div>
			<div className="flex flex-wrap gap-2">
				<PillBone width="w-[114px]" />
				<PillBone width="w-[122px]" />
			</div>
		</section>
	);
}

/*
 * The note body stays uncached: the editor autosaves, and every save would
 * bust a cached body at once (lib/cache/notes.ts). React cache() dedupes the
 * one read that generateMetadata and the page both need.
 */
const loadNote = cache(async (id: string) => {
	// Security boundary first (iron rule #2).
	const { sb } = await requireOwnerPage();
	return getNote(sb, id);
});

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const parsedId = z.uuid().safeParse((await params).id);
	if (!parsedId.success) return {};
	// A missing note leaves the default title; the page's notFound() decides the 404.
	const note = await loadNote(parsedId.data);
	return note ? { title: displayTitle(note) } : {};
}

/*
 * Everything the note decides: the editor, its attachments, and the rail. The
 * breadcrumb above it is static and comes out of the prerendered shell.
 */
async function NoteBody({ params }: { params: Promise<{ id: string }> }) {
	const { id: rawId } = await params;
	const parsedId = z.uuid().safeParse(rawId);
	if (!parsedId.success) notFound();

	// One uncached query, and the one that decides between this note and the
	// 404, so it is awaited before either section below starts.
	const [read, clock] = await Promise.all([stampRead(() => loadNote(parsedId.data)), readClock()]);
	const note = read.data;
	if (!note) notFound();
	// No view to seed: the editor's writes confirm into the entity store (#27)
	// so /notes shows them, and a write needs the store's clock — this page
	// can be the first one a tab opens.
	const snapshot = seedOf(read, clock);

	return (
		<Seed snapshot={snapshot}>
			{/* Column + rail (W2): prose left on the measure, panels right on desk,
		    stack below on phone. One tree. */}
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
		</Seed>
	);
}

/*
 * The note read is in flight: the same column-and-rail geometry, so nothing
 * moves when it lands.
 */
function NoteFallback() {
	return (
		<div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_16.25rem] lg:items-start lg:gap-10">
			<div className="min-w-0">
				<EditorFallback />
				{/* AttachmentStrip's Files section, which wraps the editor. */}
				<section aria-hidden="true" className="mt-7">
					<div className="mb-1.5 flex items-baseline gap-2">
						<TextBone className="type-section" width="w-12" />
					</div>
					<div className="mt-2">
						<PillBone width="w-[110px]" />
					</div>
				</section>
			</div>
			<LinkSectionsFallback />
		</div>
	);
}

// The route keeps no loading.tsx (#21). `params` is handed down unawaited:
// awaiting it here would make the whole page one dynamic hole again.
export default function NotePage({ params }: { params: Promise<{ id: string }> }) {
	return (
		<div>
			{/* Breadcrumb is the editor's header — the note title is content
			    (Pass 3; DESIGN.md Page Header exceptions). */}
			<BackLink href="/notes" label="Notes" />

			<Suspense fallback={<NoteFallback />}>
				<NoteBody params={params} />
			</Suspense>
		</div>
	);
}
