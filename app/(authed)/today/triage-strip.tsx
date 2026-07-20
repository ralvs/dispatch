import Link from "next/link";

export function TriageStrip({ count }: { count: number }) {
	return (
		<Link
			href="/triage"
			className="mt-5 flex items-baseline justify-between border-l-2 border-accent py-1 pl-3"
		>
			<span>
				<span className="font-mono text-eyebrow uppercase tracking-widest text-accent">Triage</span>
				<span className="ml-3 text-sm text-ink">
					{count} task{count === 1 ? "" : "s"} need{count === 1 ? "s" : ""} a home.
				</span>
			</span>
			<span className="font-mono text-meta text-ink-3">Route →</span>
		</Link>
	);
}
