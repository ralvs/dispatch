import "server-only";
import sharp from "sharp";
import { type AllowedContentType, attachmentKind } from "@/lib/attachments";

/*
 * Downscale on the way in (docs/adr/0052). R2's free tier is 10 GB; a phone
 * photo is 3-5 MB and a 2400px webp of the same photo is ~400 KB. Storing the
 * original would spend the quota an order of magnitude faster for detail no
 * screen in this app ever shows.
 *
 * The trade-off is accepted knowingly: originals are not kept and cannot be
 * recovered.
 */

/** Long edge cap. Retina-sharp at any width this app renders, including full-bleed. */
const MAX_EDGE = 2400;

export type ProcessedImage = { bytes: Uint8Array; contentType: AllowedContentType };

export async function downscaleImage(
	bytes: Uint8Array,
	contentType: AllowedContentType,
): Promise<ProcessedImage> {
	if (attachmentKind(contentType) !== "image") return { bytes, contentType };
	// Resizing an animated GIF flattens it to one frame. Not worth it — GIFs
	// are small and the animation is the whole point.
	if (contentType === "image/gif") return { bytes, contentType };

	try {
		const out = await sharp(bytes)
			// No argument: apply the EXIF orientation tag, then drop metadata.
			// This is what stops phone photos rendering sideways. It also strips
			// EXIF GPS for good — deliberate, and why AttachmentSchema's gps
			// field stays unpopulated.
			.rotate()
			.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
			.webp({ quality: 82 })
			.toBuffer();
		return { bytes: new Uint8Array(out), contentType: "image/webp" };
	} catch {
		// Corrupt file, or a HEIC the installed libvips cannot decode. A file
		// the user can still see and download beats an upload that fails.
		return { bytes, contentType };
	}
}
