import { Suspense } from "react";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { CapturePalette } from "@/components/capture-palette";
import { DesktopRail } from "@/components/desktop-rail";
import { NavShortcuts } from "@/components/nav-shortcuts";
import { requireOwnerPage } from "@/lib/auth";

function AuthedShellFallback() {
	return (
		<div className="flex h-[100dvh] flex-col pt-[env(safe-area-inset-top)]">
			<div className="relative flex flex-1 flex-col overflow-hidden">
				<main
					id="main"
					tabIndex={-1}
					className="flex-1 overflow-y-auto overscroll-contain mx-auto w-full max-w-md px-5 pb-24 pt-6 lg:max-w-6xl lg:pb-12 lg:pl-60 lg:pt-10"
				>
					<span role="status" className="sr-only">
						Loading
					</span>
					<div className="space-y-4" aria-hidden="true">
						<div className="h-8 w-40 rounded bg-surface animate-pulse" />
						<div className="h-4 w-full rounded bg-surface animate-pulse" />
						<div className="h-4 w-3/4 rounded bg-surface animate-pulse" />
					</div>
				</main>
			</div>
		</div>
	);
}

async function AuthedShell({ children }: { children: React.ReactNode }) {
	const { claims } = await requireOwnerPage();

	return (
		<div className="flex h-[100dvh] flex-col pt-[env(safe-area-inset-top)]">
			<a
				href="#main"
				className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:border focus:border-line-strong focus:bg-surface focus:px-4 focus:py-2 focus:text-ink"
			>
				Skip to content
			</a>
			{/* Theme comes from data-theme on <html> (boot script); rail is client. */}
			<DesktopRail email={claims.email ?? ""} />
			<div className="relative flex flex-1 flex-col overflow-hidden">
				<main
					id="main"
					tabIndex={-1}
					className="flex-1 overflow-y-auto overscroll-contain mx-auto w-full max-w-md px-5 pb-24 pt-6 lg:max-w-6xl lg:pb-12 lg:pl-60 lg:pt-10"
				>
					{children}
				</main>
				<CapturePalette />
				<NavShortcuts />
			</div>
			<BottomTabBar />
		</div>
	);
}

/**
 * Auth is dynamic (cookies / getClaims). Cache Components require that hop
 * behind Suspense so the route does not block as a "blocking route" (ADR-0033).
 */
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
	return (
		<Suspense fallback={<AuthedShellFallback />}>
			<AuthedShell>{children}</AuthedShell>
		</Suspense>
	);
}
