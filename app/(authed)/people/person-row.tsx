import Link from "next/link";
import { ColorDot } from "@/components/color-dot";
import { Badge, ListRow, rowTitle } from "@/components/ui";
import type { PersonRow } from "@/lib/services/people";
import { relationshipLabel } from "./constants";

/**
 * Simplest row in the app — name, optional badge, optional company. The domain
 * slot is held empty so People and Projects share one left edge when they
 * appear under the same visual language (Invisible Slot Rule).
 */
export function PersonRowItem({
	person,
	saving = false,
}: {
	person: PersonRow;
	/** Still being created: its id is the client's, so there is no page to open yet. */
	saving?: boolean;
}) {
	const body = (
		<>
			<span className={rowTitle()}>{person.name}</span>
			{person.company && <p className="mt-0.5 font-mono text-meta text-ink-4">{person.company}</p>}
		</>
	);
	return (
		<ListRow
			leading={<ColorDot color={null} hold />}
			trailing={
				person.relationship_type ? (
					<Badge tone="neutral">{relationshipLabel(person.relationship_type)}</Badge>
				) : undefined
			}
		>
			{saving ? (
				<div className="min-w-0 opacity-60">{body}</div>
			) : (
				<Link href={`/people/${person.id}`} className="block min-w-0 hover:text-accent-ink">
					{body}
				</Link>
			)}
		</ListRow>
	);
}
