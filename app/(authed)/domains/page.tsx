import { requireOwnerPage } from "@/lib/auth";
import { listDomains } from "@/lib/services/domains";
import { getAppTimezone } from "@/lib/services/settings";
import { DomainForm } from "./domain-form";
import { DomainRowItem } from "./domain-row";

export default async function DomainsPage() {
	const { sb } = await requireOwnerPage();
	const [domains, tz] = await Promise.all([
		listDomains(sb, { includeArchived: true }),
		getAppTimezone(sb),
	]);
	const active = domains.filter((d) => d.active);
	const archived = domains.filter((d) => !d.active);

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Domains</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">What I'm stewarding</h1>
			</header>

			<section className="mt-6">
				<DomainForm />
			</section>

			<section className="mt-8" aria-label="Active domains">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">Active</h2>
				{active.length === 0 ? (
					<p className="py-6 text-center font-serif italic text-ink-3">No active domains.</p>
				) : (
					<ul className="mt-2">
						{active.map((d) => (
							<DomainRowItem key={d.id} domain={d} tz={tz} />
						))}
					</ul>
				)}
			</section>

			{archived.length > 0 && (
				<section className="mt-8" aria-label="Archived domains">
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">Archived</h2>
					<ul className="mt-2">
						{archived.map((d) => (
							<DomainRowItem key={d.id} domain={d} tz={tz} />
						))}
					</ul>
				</section>
			)}
		</div>
	);
}
