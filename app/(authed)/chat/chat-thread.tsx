"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { Button } from "@/components/ui";

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
		<div className="measure-prose">
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
											? // Person wrote it: sans body 400, right, ink-2.
												// (Pass 3 — Named vs Labelled; not mono.)
												"text-right text-base font-normal leading-[1.5] tracking-[-0.01em] text-ink-2"
											: // Running prose: sans body 400, left, full ink.
												"text-base font-normal leading-[1.6] tracking-[-0.01em] text-ink"
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

			<form onSubmit={handleSubmit} className="hairline mt-6 flex items-stretch gap-2 py-3">
				<label htmlFor="chat-input" className="sr-only">
					Message
				</label>
				<input
					id="chat-input"
					aria-label="Message"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Ask about your tasks, notes, quotes…"
					className="field-shell h-auto w-full py-1.5 text-base font-normal tracking-[-0.01em] text-ink placeholder:text-ink-4"
				/>
				{/* self-stretch so the button tracks the input's height rather than its
				    own smaller mono line-box — the two sit on one line. */}
				<Button
					type="submit"
					variant="secondary"
					size="sm"
					className="self-stretch"
					aria-label="Send"
				>
					Send
				</Button>
			</form>
		</div>
	);
}
