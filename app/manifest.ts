import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Dispatch",
		short_name: "Dispatch",
		description: "Personal operations. Capture in, order out.",
		id: "/",
		start_url: "/today",
		scope: "/",
		display: "standalone",
		orientation: "portrait",
		// Manifest cannot media-query the way the viewport themeColor export
		// can. Light is the app default (THEME_BOOT, Pass 0), so the install
		// splash and OS task-switcher card use the light ground — not the
		// near-black Vercel/Geist leftover, and not the dark warm stone.
		background_color: "#fafafa",
		theme_color: "#fafafa",
		lang: "en",
		shortcuts: [{ name: "Capture", short_name: "Capture", url: "/today?capture=1" }],
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{
				src: "/icons/icon-maskable-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
	};
}
