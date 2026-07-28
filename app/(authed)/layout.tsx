import { cookies } from "next/headers";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { CapturePalette } from "@/components/capture-palette";
import { DesktopRail } from "@/components/desktop-rail";
import { NavShortcuts } from "@/components/nav-shortcuts";
import { SessionKeeper } from "@/components/session-keeper";
import { requireOwnerPage } from "@/lib/auth";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
	const { user } = await requireOwnerPage();
	const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";

	return (
		<div className="flex h-[100dvh] flex-col pt-[env(safe-area-inset-top)]">
			<SessionKeeper />
			<DesktopRail email={user.email ?? ""} theme={theme} />
			<div className="relative flex flex-1 flex-col overflow-hidden">
				<main className="flex-1 overflow-y-auto overscroll-contain mx-auto w-full max-w-md px-5 pb-8 pt-6 lg:max-w-6xl lg:pb-12 lg:pl-60 lg:pt-10">
					{children}
				</main>
				<CapturePalette />
				<NavShortcuts />
			</div>
			<BottomTabBar />
		</div>
	);
}
