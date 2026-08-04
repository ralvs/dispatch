import Link from "next/link";
import { Badge } from "@/components/ui";
import type { PersonRow } from "@/lib/services/people";
import { relationshipLabel } from "./constants";

export function PersonRowItem({ person }: { person: PersonRow }) {
	return (
		<li className="hairline py-3">
			<Link href={`/people/${person.id}`} className="flex items-center justify-between gap-3">
				<span className="min-w-0 truncate font-serif text-base text-ink">{person.name}</span>
				{person.relationship_type && (
					<Badge tone="neutral">{relationshipLabel(person.relationship_type)}</Badge>
				)}
			</Link>
			{person.company && <p className="mt-0.5 text-meta text-ink-4">{person.company}</p>}
		</li>
	);
}
