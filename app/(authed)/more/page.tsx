import Link from "next/link";
import { MORE_SECTIONS } from "@/components/nav-links";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireOwnerPage } from "@/lib/auth";

// Mobile's tail of the rail (ADR-0014). The five tabs carry the daily loop;
// everything else lands here in rail order, plus the rail footer that a phone
// otherwise never sees.
export default async function MorePage() {
	const { claims } = await requireOwnerPage();

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">More</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">The rest of the desk</h1>
			</header>

			{MORE_SECTIONS.map((section) => (
				<section key={section.title} className="mt-6" aria-label={section.title}>
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
						{section.title}
					</h2>
					<ul className="mt-1">
						{section.items.map((item) => (
							<li key={item.key} className="hairline">
								<Link
									href={item.href}
									className="flex items-baseline justify-between py-3 font-serif text-lg text-ink hover:text-accent"
								>
									{item.label}
									<span aria-hidden="true" className="font-mono text-meta text-ink-4">
										→
									</span>
								</Link>
							</li>
						))}
					</ul>
				</section>
			))}

			<section className="mt-8 space-y-3" aria-label="Account">
				<ThemeToggle />
				<p className="truncate text-meta text-ink-4" title={claims.email ?? ""}>
					{claims.email}
				</p>
				<SignOutButton />
			</section>
		</div>
	);
}
