import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	// sharp loads libvips through dlopen, which the file tracer cannot follow:
	// the .node binding gets bundled but libvips-cpp.so does not, so the
	// attachments route died with ERR_DLOPEN_FAILED on Vercel while working
	// locally. Ship the whole @img platform package with that one route.
	//
	// The key is a picomatch glob, not a literal route, so a dynamic segment
	// must be written as `*` — spelling it `[id]` makes glob read a character
	// class and the rule silently never matches.
	outputFileTracingIncludes: {
		"/api/notes/*/attachments": ["./node_modules/@img/**/*"],
	},
	// Partial Prerendering + `"use cache"` (docs/adr/0033).
	cacheComponents: true,
	// One profile for every `"use cache"` entry in lib/cache/*.
	//
	// These entries are kept honest by tags, not by the clock: every in-app
	// write goes through afterMutation and every cron / external write through
	// afterExternalMutation (lib/mutation-feedback/invalidate.ts), and both call
	// revalidateTag(tag, "max"). A short `expire` therefore bought no freshness
	// at all — it only guaranteed that coming back to the app after ten minutes
	// away paid the full Supabase fan-out again, behind a skeleton.
	//
	// `revalidate: 1h` is the real lever: past an hour Next serves the stale
	// entry immediately and refreshes behind the response, so nobody waits.
	// `expire: 7d` is the outer bound where a genuinely abandoned entry has to
	// be re-read blocking — reachable only if no write touched its tag for a
	// week. `stale: 5m` matches staleTimes.dynamic, which SoftRefresh already
	// treats as the tolerable staleness for a screen.
	cacheLife: {
		tagged: { stale: 300, revalidate: 3600, expire: 604800 },
	},
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
			// Both of these used to be a page whose whole body was redirect().
			// Config redirects are applied in the routing phase, ahead of the
			// proxy, so they cost no function invocation and no getClaims() pass —
			// a typed URL or a shared link at / was paying for two full auth
			// passes to arrive at Today. Not `permanent`: a 308 is cached by the
			// browser forever, and / should stay re-pointable.
			{ source: "/", destination: "/today", permanent: false },
			// /more is no longer a page (Pass 4 / C4). More is a menu. Old
			// bookmarks and deep links land on Today rather than 404.
			{ source: "/more", destination: "/today", permanent: false },
		];
	},
};

export default nextConfig;
