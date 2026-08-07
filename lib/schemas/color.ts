import { z } from "zod";

/**
 * A domain's colour is stored as a **palette slug**, not a hex string.
 *
 * A stored hex cannot theme-switch, and dark is a full peer of light now
 * (app/globals.css) — so the row names a slot and the theme resolves it to a
 * light/dark pair via `var(--domain-<slug>)`. Retuning a colour becomes a
 * token edit rather than an UPDATE.
 *
 * Nine slots: the seven seeded stewardship domains plus two spares. They were
 * generated in OKLCH and measured against three floors — ΔEok ≥ 0.12 between
 * any two (the smallest form is a 9px dot), ≥ 0.15 from the accent and the
 * priority ring (confusing a domain with a *state* is worse than confusing two
 * domains), and ≥ 3:1 on their own ground — met in both themes. Evidence and
 * method: .impeccable/mocks/palette-lab.html. Retune there, never by hand.
 *
 * The eight-hex palette this replaces was tuned for the warm linen ground of
 * an identity two visual worlds ago, and its rust was byte-identical to the
 * accent — so every Engine dot read as "interactive" or "overdue".
 */
export const COLOR_SLUGS = [
	"engine",
	"health",
	"family",
	"spirit",
	"finance",
	"code",
	"travel",
	"pine",
	"burgundy",
] as const;

export type ColorSlug = (typeof COLOR_SLUGS)[number];

export const ColorSlugSchema = z.enum(COLOR_SLUGS);

/** Human labels for the picker. The slug is the identity; this is the name. */
export const COLOR_SLUG_LABELS: Record<ColorSlug, string> = {
	engine: "Iris",
	health: "Fern",
	family: "Orchid",
	spirit: "Clay",
	finance: "Azure",
	code: "Cyan",
	travel: "Brass",
	pine: "Pine",
	burgundy: "Burgundy",
};

/**
 * The CSS custom property a slug resolves to. Anything rendering a domain
 * colour goes through here rather than interpolating the slug itself, so the
 * token naming stays in one place.
 */
export function colorSlugVar(slug: string): string {
	return `var(--domain-${slug})`;
}

/** True when a stored value is one of the nine slots. */
export function isColorSlug(value: unknown): value is ColorSlug {
	return typeof value === "string" && (COLOR_SLUGS as readonly string[]).includes(value);
}
