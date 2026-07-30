import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	// Partial Prerendering + `"use cache"` (docs/adr/0033).
	cacheComponents: true,
	// Server Actions default to a 1MB body cap — fine for forms, fatal for
	// phone photos posted through upload actions. Match the reference's 25MB.
	experimental: {
		serverActions: {
			bodySizeLimit: "25mb",
		},
		// Dynamic authed routes default to 0s client RSC retention — every tab
		// revisit re-fetched the full tree. Keep the last payload briefly so
		// Today ↔ Tasks ↔ Notes feels instant; mutations still revalidatePath.
		staleTimes: {
			dynamic: 30,
			static: 180,
		},
	},
	async redirects() {
		return [
			// The unassigned-task queue is /inbox again (docs/adr/0024). It briefly
			// lived at /triage under ADR-0014, when the link reading list was
			// competing for the word "inbox"; that list is /links now.
			{ source: "/triage", destination: "/inbox", permanent: true },
		];
	},
};

export default nextConfig;
