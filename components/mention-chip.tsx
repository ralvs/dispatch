import Link from "next/link";
import { MENTION_CHIP_CLASS } from "@/components/ui/badge";

/** Re-export for TipTap mention-extension + existing importers. */
export { MENTION_CHIP_CLASS };

/** A single "@Name" chip linking to /people/[id] — the task-row rendering of a mention. */
export function MentionChip({ id, name }: { id: string; name: string }) {
	return (
		<Link
			href={`/people/${id}`}
			className={MENTION_CHIP_CLASS}
			onClick={(e) => e.stopPropagation()}
		>
			@{name}
		</Link>
	);
}
