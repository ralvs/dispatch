import { cookies } from "next/headers";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { DesktopRail } from "@/components/desktop-rail";
import { requireOwnerPage } from "@/lib/auth";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
	const user = await requireOwnerPage();
	const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";

	return (
		<>
			<DesktopRail email={user.email ?? ""} theme={theme} />
			<main className="mx-auto max-w-md px-5 pb-28 pt-6 lg:max-w-4xl lg:pb-12 lg:pl-60 lg:pt-10">
				{children}
			</main>
			<BottomTabBar />
		</>
	);
}
