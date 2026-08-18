import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	// sharp loads libvips through dlopen, which the file tracer cannot follow:
	// the .node binding gets bundled but libvips-cpp.so does not, so the
	// attachments route died with ERR_DLOPEN_FAILED on Vercel while working
	// locally. Ship the whole @img platform package with that one route.
	outputFileTracingIncludes: {
		"/api/notes/[id]/attachments": ["./node_modules/@img/**/*"],
	},
	// Partial Prerendering + `"use cache"` (docs/adr/0033).
	cacheComponents: true,
	// Server Actions default to a 1MB body cap — fine for forms, fatal for
	// phone photos posted through upload actions. Match the reference's 25MB.
	experimental: {
		serverActions: {
			bodySizeLimit: "25mb",
		},
		// Dynamic authed routes default to 0s client RSC retention — every tab
		// revisit re-fetched the full tree. Every authed route is dynamic
		// (requireOwnerPage reads cookies) and every one has a loading.tsx, so
		// an expired entry means a skeleton, not a stale-then-fresh swap: Next
		// deletes a stale entry on navigation rather than reusing it
		// (ppr-navigations.js reads the BFCache with the real `now`, unlike
		// back/forward which passes -1). There is no route-level SWR to opt
		// into, so the only lever is how long the instant window lasts.
		//
		// 5 minutes matches SoftRefresh's own interval — the app already treats
		// that as the tolerable staleness for a screen. It's safe to go this
		// long because any revalidatePath evicts the whole client cache, so you
		// can never see your OWN writes go stale; only the calendar/reminder
		// crons can drift, and /today self-refreshes on the same cadence.
		staleTimes: {
			dynamic: 300,
			static: 300,
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
