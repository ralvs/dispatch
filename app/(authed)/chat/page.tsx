import { PageHeader } from "@/components/ui";
import { ChatThread } from "./chat-thread";

/*
 * Fully static: the page reads nothing, so it has no requireOwnerPage() of its
 * own and comes out of the prerendered shell whole. The layout's OwnerGate
 * still bounces a non-owner, and every read happens in /api/chat, which runs
 * the owner check itself (iron rule #2).
 */
export default function ChatPage() {
	return (
		<div>
			{/* "Ask" is what the shell's action calls this, so it is the name.
			    The subtitle states the boundary — read-only — which is the one
			    thing worth knowing before typing. */}
			<PageHeader title="Ask" subtitle="Read-only over your tasks, notes, quotes and projects." />

			<ChatThread />
		</div>
	);
}
