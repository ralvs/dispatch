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
		background_color: "#0a0a0a",
		theme_color: "#0a0a0a",
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
