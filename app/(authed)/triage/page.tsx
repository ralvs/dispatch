import { requireOwnerPage } from "@/lib/auth";
import { listDomains } from "@/lib/services/domains";
import { listInboxTasks } from "@/lib/services/tasks";
import { TriageRow } from "./triage-row";

// Routing unassigned tasks out of the system Inbox domain (ADR-0014). Not the
// link reading list — that is Links at /links.
export default async function TriagePage() {
	const { sb } = await requireOwnerPage();
	const [tasks, domains] = await Promise.all([listInboxTasks(sb), listDomains(sb)]);

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Triage</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Awaiting triage</h1>
				<p className="mt-1 text-meta text-ink-3">
					Captured tasks without a home. Route each one to its domain.
				</p>
			</header>

			{tasks.length === 0 ? (
				<p className="py-10 text-center font-serif italic text-ink-3">
					Nothing awaiting triage. Well kept.
				</p>
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
