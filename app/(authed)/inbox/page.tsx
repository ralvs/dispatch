import { PageHeader } from "@/components/ui";
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
			{/* The subtitle survives here because it is an instruction, not a
			    tagline: filing is the whole job of the page. */}
			<PageHeader title="Inbox" subtitle="Captured tasks without a home. Give each one a domain." />

			<InboxList tasks={tasks} domains={domains} taskNoteIds={taskNoteIds} />
		</div>
	);
}
