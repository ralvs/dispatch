import Link from "next/link";

/** The mono breadcrumb's look, shared by the link and the More button. */
export const BACK_LINK_CLASS =
	"font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink";

/**
 * The way back above a page header: `← Notes`, `← Projects` (DESIGN.md, Page
 * header). `pb-4` keeps the shell's 64px above it and puts the header under it,
 * as on every detail page. It is not data, so a page renders it above its own
 * Suspense boundary and it comes out of the prerendered shell.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
	return (
		<nav aria-label="Breadcrumb" className="pb-4">
			<Link href={href} className={BACK_LINK_CLASS}>
				← {label}
			</Link>
		</nav>
	);
}
