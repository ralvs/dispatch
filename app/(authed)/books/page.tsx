import { requireOwnerPage } from "@/lib/auth";
import type { BookStatus } from "@/lib/schemas/book";
import { listBooks } from "@/lib/services/books";
import { BookForm } from "./book-form";
import { BookRowItem } from "./book-row";

const STATUS_ORDER: { status: BookStatus; label: string }[] = [
	{ status: "reading", label: "Reading" },
	{ status: "want_to_read", label: "Want to read" },
	{ status: "finished", label: "Finished" },
	{ status: "abandoned", label: "Abandoned" },
];

export default async function BooksPage() {
	const { sb } = await requireOwnerPage();
	const books = await listBooks(sb);
	const byStatus = new Map<BookStatus, typeof books>();
	for (const book of books) {
		const bucket = byStatus.get(book.status);
		if (bucket) bucket.push(book);
		else byStatus.set(book.status, [book]);
	}

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Books</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Reading log</h1>
			</header>

			<section className="mt-6">
				<BookForm />
			</section>

			{books.length === 0 ? (
				<p className="mt-6 py-8 text-center font-serif italic text-ink-3">
					No books yet. Add one you're reading, or want to.
				</p>
			) : (
				STATUS_ORDER.map(({ status, label }) => {
					const group = byStatus.get(status);
					if (!group || group.length === 0) return null;
					return (
						<section key={status} className="mt-8">
							<h2 className="font-serif text-xl text-ink">{label}</h2>
							<ul className="mt-2" aria-label={label}>
								{group.map((book) => (
									<BookRowItem key={book.id} book={book} />
								))}
							</ul>
						</section>
					);
				})
			)}
		</div>
	);
}
