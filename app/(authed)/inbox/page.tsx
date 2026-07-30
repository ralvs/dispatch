import { requireOwnerPage } from "@/lib/auth";
import { listDomains } from "@/lib/services/domains";
import { listNoteIdsForTargets } from "@/lib/services/note-links";
import { listInboxTasks } from "@/lib/services/tasks";
import { InboxList } from "./inbox-list";

// Tasks captured without a domain, waiting to be given one (docs/adr/0024).
// Filing is one-way: a task leaves here and never comes back.
export default async function InboxPage() {
	const { sb } = await requireOwnerPage();
	const [tasks, domains] = await Promise.all([listInboxTasks(sb), listDomains(sb)]);
	const taskNoteIds = Object.fromEntries(
		await listNoteIdsForTargets(
			sb,
			"task",
			tasks.map((t) => t.id),
		),
	);

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Inbox</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">The inbox</h1>
				<p className="mt-1 text-meta text-ink-3">
					Captured tasks without a home. Give each one a domain.
				</p>
			</header>

			<InboxList tasks={tasks} domains={domains} taskNoteIds={taskNoteIds} />
		</div>
	);
}
