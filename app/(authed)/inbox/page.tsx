import { PageHeader } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomains } from "@/lib/cache/domains";
import { getCachedInbox } from "@/lib/cache/inbox";
import { InboxList } from "./inbox-list";

// Tasks captured without a domain, waiting to be given one (docs/adr/0024).
// Filing is one-way: a task leaves here and never comes back.
export default async function InboxPage() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [{ tasks, taskNoteIds }, domains] = await Promise.all([
		getCachedInbox(),
		getCachedDomains(false),
	]);

	return (
		<div>
			{/* The subtitle survives here because it is an instruction, not a
			    tagline: filing is the whole job of the page. */}
			<PageHeader title="Inbox" subtitle="Captured tasks without a home. Give each one a domain." />

			<InboxList tasks={tasks} domains={domains} taskNoteIds={taskNoteIds} />
		</div>
	);
}
