import { PageHeader } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { ChatThread } from "./chat-thread";

export default async function ChatPage() {
	await requireOwnerPage();

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
