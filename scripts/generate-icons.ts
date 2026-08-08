// Generates the PWA icon set referenced by app/manifest.ts and the
// apple-touch-icon + favicon in app/layout.tsx. Run once via
// `bun run scripts/generate-icons.ts` and commit the resulting PNGs — this
// script is dev-tooling, not part of the runtime build.
//
// The mark is the app's own BrandMark (components/brand-mark.tsx): an accent
// squircle with a dispatched chevron cut into it. The geometry below is that
// component's, expressed in SVG so it can be rasterized — keep the two in step.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// The base brand accent (--accent in :root). The dark theme's #ff6f2c is a
// tint for dark surfaces; a home-screen icon sits on an unknown wallpaper, so
// it carries the base orange.
const ACCENT = "#f15a0f";
const OUT_DIR = path.join(import.meta.dirname, "..", "public", "icons");

/**
 * The mark on a full accent field.
 *
 * `radiusRatio` is the squircle's corner as a fraction of the edge — the
 * brand's own 0.3 where the icon is shown as-drawn, 0 where the platform
 * applies its own mask. `glyphScale` shrinks the chevron toward the centre for
 * the maskable variant's safe zone.
 */
function svg(size: number, radiusRatio: number, glyphScale: number): string {
	// BrandMark's box: inset 0.3 vertically, 0.264 horizontally, stroke 0.077.
	const stroke = size * 0.077;
	const left = size * 0.264;
	const right = size * 0.736;
	const top = size * 0.3;
	const bottom = size * 0.7;
	const half = stroke / 2;
	const c = size / 2;
	// The component's `translate(1px, -1px)` at its 26px reference size.
	const nudge = size / 26;
	// border-left + border-bottom of a box, rotated -45° — an L becomes a tick.
	const tick = `M ${left + half} ${top} L ${left + half} ${bottom - half} L ${right} ${bottom - half}`;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
	<rect width="${size}" height="${size}" rx="${size * radiusRatio}" ry="${size * radiusRatio}" fill="${ACCENT}"/>
	<g transform="translate(${c} ${c}) scale(${glyphScale}) translate(${-c} ${-c})">
		<path d="${tick}" transform="rotate(-45 ${c} ${c}) translate(${nudge} ${-nudge})"
			fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linecap="butt" stroke-linejoin="miter"/>
	</g>
</svg>`;
}

async function render(name: string, size: number, radiusRatio: number, glyphScale: number) {
	await sharp(Buffer.from(svg(size, radiusRatio, glyphScale)))
		.png()
		.toFile(path.join(OUT_DIR, name));
	console.log(`wrote ${name}`);
}

async function main() {
	await mkdir(OUT_DIR, { recursive: true });
	// Standard "any" icons — drawn as the mark is drawn, corners and all.
	await render("icon-192.png", 192, 0.3, 1);
	await render("icon-512.png", 512, 0.3, 1);
	// Maskable — square field (the platform cuts the shape) with the glyph
	// pulled into the ~80% safe zone.
	await render("icon-maskable-512.png", 512, 0, 0.8);
	// Apple applies its own squircle to a fully opaque square.
	await render("apple-touch-icon-180.png", 180, 0, 1);
	// Favicon: the mark at tab size. Kept as a PNG — every browser Next.js
	// targets reads one, and .ico would only add a format to regenerate.
	await render("favicon-32.png", 32, 0.3, 1);
}

main();
