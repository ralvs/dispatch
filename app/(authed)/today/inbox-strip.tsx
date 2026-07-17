import Link from "next/link";

export function InboxStrip({ count }: { count: number }) {
	return (
		<Link
			href="/inbox"
			className="mt-5 flex items-baseline justify-between border-l-2 border-accent py-1 pl-3"
		>
			<span>
				<span className="font-mono text-eyebrow uppercase tracking-widest text-accent">Inbox</span>
				<span className="ml-3 text-sm text-ink">
					{count} task{count === 1 ? "" : "s"} need{count === 1 ? "s" : ""} a home.
				</span>
			</span>
			<span className="font-mono text-meta text-ink-3">Triage →</span>
		</Link>
	);
}
