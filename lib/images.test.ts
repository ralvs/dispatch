import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { downscaleImage } from "@/lib/images";

/** A real encoded image, so the test exercises libvips rather than a stub. */
async function png(width: number, height: number): Promise<Uint8Array> {
	const buf = await sharp({
		create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } },
	})
		.png()
		.toBuffer();
	return new Uint8Array(buf);
}

async function dimensions(bytes: Uint8Array) {
	const meta = await sharp(bytes).metadata();
	return { width: meta.width, height: meta.height, format: meta.format };
}

describe("downscaleImage", () => {
	it("caps the long edge at 2400px and re-encodes to webp", async () => {
		const original = await png(4000, 3000);
		const result = await downscaleImage(original, "image/png");

		expect(result.contentType).toBe("image/webp");
		const { width, height, format } = await dimensions(result.bytes);
		expect(format).toBe("webp");
		expect(width).toBe(2400);
		// Aspect ratio preserved by fit:"inside".
		expect(height).toBe(1800);
	});

	it("shrinks the byte count substantially — the reason this exists", async () => {
		const original = await png(4000, 3000);
		const result = await downscaleImage(original, "image/png");
		expect(result.bytes.byteLength).toBeLessThan(original.byteLength);
	});

	it("does not enlarge an image already under the cap", async () => {
		const original = await png(800, 600);
		const result = await downscaleImage(original, "image/png");
		const { width, height } = await dimensions(result.bytes);
		expect(width).toBe(800);
		expect(height).toBe(600);
	});

	it("passes a GIF through untouched, so animation survives", async () => {
		const original = await png(3000, 3000);
		const result = await downscaleImage(original, "image/gif");
		expect(result.contentType).toBe("image/gif");
		expect(result.bytes).toBe(original);
	});

	it("passes non-images through untouched", async () => {
		const pdf = new TextEncoder().encode("%PDF-1.7 ...");
		const result = await downscaleImage(pdf, "application/pdf");
		expect(result.contentType).toBe("application/pdf");
		expect(result.bytes).toBe(pdf);
	});

	// An upload that fails is worse than an unoptimized file.
	it("returns the input unchanged when the bytes are not decodable", async () => {
		const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
		const result = await downscaleImage(junk, "image/png");
		expect(result.bytes).toBe(junk);
		expect(result.contentType).toBe("image/png");
	});
});
