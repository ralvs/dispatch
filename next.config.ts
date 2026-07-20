import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	// Server Actions default to a 1MB body cap — fine for forms, fatal for
	// phone photos posted through upload actions. Match the reference's 25MB.
	experimental: {
		serverActions: {
			bodySizeLimit: "25mb",
		},
	},
	async redirects() {
		return [
			// Task triage moved to /triage (ADR-0014). /inbox is not the link
			// reading list — that is Ingest at /ingest — so send old bookmarks
			// to the page they actually meant.
			{ source: "/inbox", destination: "/triage", permanent: true },
		];
	},
};

export default nextConfig;
