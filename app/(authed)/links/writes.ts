// The link kind's writes (docs/adr/0077): the intent and its server call from
// the same arguments. Client-safe — server-action references only.

import { type Write, write } from "@/lib/store/write";
import { setLinkStatusAction } from "./actions";

const LINK_STATUS_COPY = {
	unread: "Marked unread",
	read: "Marked read",
	dismissed: "Link dismissed",
} as const;

export const linkWrites = {
	/** Move a link between Unread and Read, or out of the list on a dismissal. */
	setStatus: (id: string, status: "unread" | "read" | "dismissed"): Write<"link"> =>
		write(
			"link",
			{ type: "patch", id, patch: { status } },
			() => setLinkStatusAction(id, status),
			"Couldn't update link.",
			LINK_STATUS_COPY[status],
		),
};
