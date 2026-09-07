import { COLOR_SLUGS, colorSlugVar } from "@/lib/schemas/color";

export const INK_SLUGS = [...COLOR_SLUGS, "accent", "error"] as const;
export type InkSlug = (typeof INK_SLUGS)[number];

export const INK_SLUG_LABELS: Record<InkSlug, string> = {
	accent: "Orange",
	error: "Red",
	engine: "Indigo",
	health: "Green",
	family: "Orchid",
	spirit: "Clay",
	finance: "Blue",
	code: "Cyan",
	travel: "Yellow",
	pine: "Teal",
	burgundy: "Rose",
};

export function isInkSlug(value: unknown): value is InkSlug {
	return typeof value === "string" && (INK_SLUGS as readonly string[]).includes(value);
}

export function inkVar(slug: string): string {
	if (slug === "accent") return "var(--accent)";
	if (slug === "error") return "var(--error)";
	return colorSlugVar(slug);
}
