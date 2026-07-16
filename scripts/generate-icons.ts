// Generates the PWA icon set referenced by app/manifest.ts and the
// apple-touch-icon in app/layout.tsx. Run once via `bun run scripts/generate-icons.ts`
// and commit the resulting PNGs — this script is dev-tooling, not part of the
// runtime build.
//
// The mark is a plain editorial square (dark field, accent glyph, sharp
// corners) built as an SVG string and rasterized with sharp.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BG = "#16130f";
const ACCENT = "#d3654a";
const OUT_DIR = path.join(import.meta.dirname, "..", "public", "icons");

/** Square field with a centered accent glyph inset to `glyphRatio` of the size. */
function svg(size: number, glyphRatio: number): string {
	const glyph = size * glyphRatio;
	const offset = (size - glyph) / 2;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
	<rect width="${size}" height="${size}" fill="${BG}"/>
	<rect x="${offset}" y="${offset}" width="${glyph}" height="${glyph}" fill="${ACCENT}"/>
</svg>`;
}

async function render(name: string, size: number, glyphRatio: number, opaque: boolean) {
	const image = sharp(Buffer.from(svg(size, glyphRatio))).resize(size, size);
	await (opaque ? image.flatten({ background: BG }) : image).png().toFile(path.join(OUT_DIR, name));
	console.log(`wrote ${name}`);
}

async function main() {
	await mkdir(OUT_DIR, { recursive: true });
	// Standard "any" purpose icons — full-bleed glyph.
	await render("icon-192.png", 192, 0.55, false);
	await render("icon-512.png", 512, 0.55, false);
	// Maskable icon — glyph inset to ~80% to stay inside the safe zone.
	await render("icon-maskable-512.png", 512, 0.8, false);
	// Apple touch icon must be fully opaque.
	await render("apple-touch-icon-180.png", 180, 0.55, true);
}

main();
