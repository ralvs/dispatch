import { z } from "zod";

// Curated palette. Picked to read well on the warm linen background
// (#F6F2EA). Keep this list short — paradox of choice — and stable so
// every project picker shows the same swatches in the same order.
export const COLOR_PALETTE = [
	"#B8442B", // rust (matches our accent)
	"#3F5B47", // pine
	"#3A4663", // indigo
	"#C9A063", // ochre
	"#7A2E36", // burgundy
	"#3F6968", // teal
	"#7A6A8E", // lavender
	"#7A726B", // stone
] as const;

export const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
