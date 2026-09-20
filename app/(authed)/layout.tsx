import { Suspense } from "react";
import { AppHeader, AppHeaderView } from "@/components/app-header";
import { BottomTabBar, BottomTabBarView } from "@/components/bottom-tab-bar";
import { CapturePalette } from "@/components/capture-palette";
import { FindPalette } from "@/components/find-palette";
import { MoreMenu } from "@/components/more-menu";
import { NavShortcuts } from "@/components/nav-shortcuts";
import { requireOwnerPage } from "@/lib/auth";

/*
 * Full-height shell. `dvh` tracks the collapsing toolbars in a browser tab;
 * installed (standalone) it is pinned to the initial containing block instead,
 * because iOS resolves viewport units there against a stale, inset-subtracted
 * viewport — see the .app-shell rule in app/globals.css.
 */
const SHELL = "app-shell flex h-[100dvh] flex-col pt-[env(safe-area-inset-top)]";

/*
 * The page frame. The header scrolls with the content rather than pinning: it
 * is orientation, not a control surface you reach for mid-scroll, and Today's
 * own sticky dateline is what has to survive scrolling on a phone.
 */
const FRAME = "mx-auto w-full max-w-md px-5 pb-28 pt-6 lg:max-w-6xl lg:px-11 lg:pb-20 lg:pt-8";

/**
 * Iron rule #2 — the shell is a page load, so the boundary runs here even
 * though nothing below reads the claims any more: identity and sign-out live
 * on /settings (Pass 4 / C4).
 *
 * It renders nothing, and it sits in its own Suspense, because awaiting it in
 * AuthedShell put the entire app chrome inside one dynamic hole. The
 * prerendered shell of every authed route was then literally the word
 * "Loading" — the nav, the dock and the page frame all waited on a cookie read
 * in a serverless function on another continent before anything could paint.
 * Nothing here is secret: the frame is the same markup for every route, and
 * the data behind it is still guarded, because every page awaits
 * requireOwnerPage() before its own first read.
 */
async function OwnerGate() {
	await requireOwnerPage();
	return null;
}

function AuthedShell({ children }: { children: React.ReactNode }) {
	return (
		<div className={SHELL}>
			<a
				href="#main"
				className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:border focus:border-line-strong focus:bg-surface focus:px-4 focus:py-2 focus:text-ink"
			>
				Skip to content
			</a>
			<div className="relative flex flex-1 flex-col overflow-hidden">
				<main id="main" tabIndex={-1} className="flex-1 w-full overflow-y-auto overscroll-contain">
					<div className={FRAME}>
						<Suspense fallback={null}>
							<OwnerGate />
						</Suspense>
						{/* Theme comes from data-theme on <html> (boot script); the
						 * header is client. Below `lg` it hides and the dock carries
						 * the same five destinations.
						 *
						 * The Suspense is for usePathname, which Cache Components
						 * treats as dynamic data on a dynamic route (/notes/[id] and
						 * friends). The fallback is the same markup with no tab lit,
						 * so the chrome still comes out of the prerendered shell. */}
						<Suspense fallback={<AppHeaderView pathname={null} />}>
							<AppHeader />
						</Suspense>
						{children}
					</div>
				</main>
				<CapturePalette />
				<FindPalette />
				{/* Renders nothing until opened, so an empty fallback is the
				    whole component at rest. */}
				<Suspense fallback={null}>
					<MoreMenu />
				</Suspense>
				<NavShortcuts />
			</div>
			<Suspense fallback={<BottomTabBarView pathname={null} />}>
				<BottomTabBar />
			</Suspense>
		</div>
	);
}

/**
 * The shell itself is static and prerendered. Auth is still dynamic (cookies /
 * getClaims), but it is a hole inside the shell now rather than the shell being
 * a hole inside the route — see OwnerGate. Each page's own body remains its own
 * dynamic hole, covered by that route's loading.tsx.
 */
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
	return <AuthedShell>{children}</AuthedShell>;
}
