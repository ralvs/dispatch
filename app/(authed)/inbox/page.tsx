import { requireOwnerPage } from "@/lib/auth";
import { listDomains, listInboxTasks } from "@/lib/services/tasks";
import { TriageRow } from "./triage-row";

export default async function InboxPage() {
	const { sb } = await requireOwnerPage();
	const [tasks, domains] = await Promise.all([listInboxTasks(sb), listDomains(sb)]);

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Inbox</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Awaiting triage</h1>
				<p className="mt-1 text-meta text-ink-3">
					Captured tasks without a home. Route each one to its domain.
				</p>
			</header>

			{tasks.length === 0 ? (
				<p className="py-10 text-center font-serif italic text-ink-3">Inbox zero. Well kept.</p>
			) : (
				<ul className="mt-4">
					{tasks.map((t) => (
						<TriageRow key={t.id} task={t} domains={domains} />
					))}
				</ul>
			)}
		</div>
	);
}
