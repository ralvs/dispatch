"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

export function ChatThread() {
	const { messages, sendMessage, status } = useChat({
		transport: new DefaultChatTransport({ api: "/api/chat" }),
	});
	const [input, setInput] = useState("");

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const text = input.trim();
		if (!text) return;
		sendMessage({ text });
		setInput("");
	}

	const lastMessage = messages.at(-1);
	const lastMessageText =
		lastMessage?.role === "assistant"
			? lastMessage.parts
					.filter((p) => p.type === "text")
					.map((p) => p.text)
					.join("")
			: "";

	return (
		<div className="mt-6">
			<ul className="space-y-4">
				{messages.map((message) => (
					<li key={message.id}>
						{message.parts.map((part, i) =>
							part.type === "text" ? (
								<p
									// biome-ignore lint/suspicious/noArrayIndexKey: a message's parts are a fixed, append-only stream — never reordered or filtered after render.
									key={`${message.id}-${i}`}
									className={
										message.role === "user"
											? "text-right font-mono text-sm text-ink-2"
											: "max-w-prose font-serif text-base text-ink"
									}
								>
									{part.text}
								</p>
							) : null,
						)}
					</li>
				))}
			</ul>

			{/* Announce the streaming/settled transition, not each token — a
			    live region that updated per-chunk would be unusable with a
			    screen reader. `status` flips announce "Answering…", and the
			    assistant's finished text is announced once it settles. */}
			<div aria-live="polite" className="sr-only">
				{status === "streaming" ? "Answering…" : status === "ready" ? lastMessageText : ""}
			</div>
			{status === "streaming" && (
				<p aria-hidden="true" className="mt-3 font-mono text-meta text-ink-4">
					…
				</p>
			)}

			<form onSubmit={handleSubmit} className="hairline mt-6 flex items-center gap-2 py-3">
				<label htmlFor="chat-input" className="sr-only">
					Message
				</label>
				<input
					id="chat-input"
					aria-label="Message"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Ask about your tasks, notes, quotes…"
					className="field-shell h-auto w-full py-1.5 font-serif text-base text-ink placeholder:text-ink-4"
				/>
				{/* self-stretch so the button tracks the input's height rather than its
				    own smaller mono line-box — the two sit on one line. */}
				<button
					type="submit"
					aria-label="Send"
					className="self-stretch rounded-control border border-line-strong px-3 font-mono text-eyebrow uppercase tracking-widest text-ink-2 hover:text-ink active:opacity-70"
				>
					Send
				</button>
			</form>
		</div>
	);
}
