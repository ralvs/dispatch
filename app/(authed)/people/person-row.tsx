import Link from "next/link";
import type { PersonRow } from "@/lib/services/people";

export function PersonRowItem({ person }: { person: PersonRow }) {
	return (
		<li className="hairline py-3">
			<Link href={`/people/${person.id}`} className="flex items-baseline justify-between gap-3">
				<span className="font-serif text-base text-ink">{person.name}</span>
				{person.relationship_type && (
					<span className="shrink-0 border border-line px-1.5 py-0.5 font-mono text-meta uppercase tracking-widest text-ink-3">
						{person.relationship_type}
					</span>
				)}
			</Link>
			{person.company && <p className="mt-0.5 text-meta text-ink-4">{person.company}</p>}
		</li>
	);
}
