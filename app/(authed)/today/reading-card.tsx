import Link from "next/link";
import type { BookRow } from "@/lib/services/books";

export function ReadingCard({ books }: { books: BookRow[] }) {
	if (books.length === 0) return null;

	return (
		<section className="mt-8" aria-label="Currently reading">
			<div className="flex items-baseline justify-between">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Reading</h2>
				<Link href="/books" className="font-mono text-meta text-ink-4 hover:text-ink-2">
					All →
				</Link>
			</div>
			<ul className="mt-2">
				{books.map((book) => (
					<li key={book.id} className="border-b border-line py-2.5">
						<p className="font-serif text-lg text-ink">{book.title}</p>
						{book.author && <p className="mt-0.5 font-mono text-meta text-ink-4">{book.author}</p>}
					</li>
				))}
			</ul>
		</section>
	);
}
