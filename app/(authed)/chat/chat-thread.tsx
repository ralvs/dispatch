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
											: "font-serif text-base text-ink"
									}
								>
									{part.text}
								</p>
							) : null,
						)}
					</li>
				))}
			</ul>

			{status === "streaming" && <p className="mt-3 font-mono text-meta text-ink-4">…</p>}

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
					className="w-full rounded-md border border-line bg-surface px-2 py-1.5 font-serif text-base text-ink placeholder:text-ink-4"
				/>
				<button
					type="submit"
					aria-label="Send"
					className="rounded-md border border-line-strong px-3 py-1.5 font-mono text-meta uppercase tracking-widest text-ink-2 hover:text-ink"
				>
					Send
				</button>
			</form>
		</div>
	);
}
