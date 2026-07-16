import { requireOwnerPage } from "@/lib/auth";
import { listPeople } from "@/lib/services/people";
import { PersonForm } from "./person-form";
import { PersonRowItem } from "./person-row";

export default async function PeoplePage() {
	const { sb } = await requireOwnerPage();
	const people = await listPeople(sb);

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">People</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Who matters</h1>
			</header>

			<section className="mt-6">
				<PersonForm />
			</section>

			<section className="mt-6" aria-label="People">
				{people.length === 0 ? (
					<p className="py-8 text-center font-serif italic text-ink-3">
						No one here yet. Add someone.
					</p>
				) : (
					<ul className="mt-2">
						{people.map((p) => (
							<PersonRowItem key={p.id} person={p} />
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
