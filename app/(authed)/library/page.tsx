import Link from "next/link";
import { PushToggle } from "@/components/push-toggle";
import { requireOwnerPage } from "@/lib/auth";

type ShelfItem = { href: string; label: string; blurb: string };

const SHELF: ShelfItem[] = [
	{ href: "/books", label: "Books", blurb: "Reading log — current, wanted, finished." },
	{ href: "/notes", label: "Notes", blurb: "Loose thoughts and captures awaiting review." },
	{ href: "/quotes", label: "Quotes", blurb: "Lines worth keeping, with annotations." },
	{ href: "/journal", label: "Journal", blurb: "Daily entries, grouped by day." },
];

const MORE: ShelfItem[] = [
	{ href: "/routines", label: "Routines", blurb: "Daily practice, streaks, heatmap." },
	{ href: "/health", label: "Health", blurb: "Metrics, medications, visits, labs, workouts." },
	{ href: "/chat", label: "Chat", blurb: "Ask about your tasks, notes, quotes, and more." },
];

function Shelf({ label, items }: { label: string; items: ShelfItem[] }) {
	return (
		<section className="mt-6" aria-label={label}>
			<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">{label}</h2>
			<ul className="mt-2">
				{items.map((item) => (
					<li key={item.href} className="border-b border-line">
						<Link href={item.href} className="block py-4 hover:bg-surface">
							<span className="font-serif text-xl text-ink">{item.label}</span>
							<span className="mt-0.5 block font-mono text-meta text-ink-4">{item.blurb}</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}

export default async function LibraryPage() {
	await requireOwnerPage();

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Library</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">The stacks</h1>
			</header>

			<Shelf label="Shelves" items={SHELF} />
			<Shelf label="Elsewhere" items={MORE} />

			<section className="mt-6" aria-label="Notifications">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
					Notifications
				</h2>
				<div className="mt-2 border-b border-line pb-4">
					<PushToggle />
				</div>
			</section>
		</div>
	);
}
