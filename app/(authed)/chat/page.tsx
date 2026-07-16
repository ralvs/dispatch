import { requireOwnerPage } from "@/lib/auth";
import { ChatThread } from "./chat-thread";

export default async function ChatPage() {
	await requireOwnerPage();

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Ask</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Chat</h1>
				<p className="mt-1 font-mono text-meta text-ink-4">
					Read-only over your tasks, notes, quotes, projects
				</p>
			</header>

			<ChatThread />
		</div>
	);
}
