import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { AppToaster } from "@/components/app-toaster";
import { SessionKeeper } from "@/components/session-keeper";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist",
});

const geistMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-geist-mono",
});

export const metadata: Metadata = {
	title: "Dispatch",
	description: "Personal operations. Voice in, order out.",
	appleWebApp: {
		capable: true,
		title: "Dispatch",
		statusBarStyle: "black-translucent",
	},
	icons: {
		icon: "/icons/icon-192.png",
		apple: "/icons/apple-touch-icon-180.png",
	},
};

export const viewport: Viewport = {
	// Follows the OS color-scheme preference. The in-app toggle is a
	// cookie-driven data-theme override applied after hydration, so browser
	// chrome and canvas can disagree when the user overrides the OS
	// preference — a known, accepted limitation of a static viewport export.
	themeColor: [
		{ media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
		{ media: "(prefers-color-scheme: light)", color: "#fafafa" },
	],
	viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";

	return (
		<html lang="en" data-theme={theme} className={`${geist.variable} ${geistMono.variable}`}>
			<body>
				{/* Root-level: must run on /sign-in too so a cold-start bounce can
				 * recover a still-valid refresh cookie (docs/adr/0032). */}
				<SessionKeeper />
				{children}
				<AppToaster />
				<SwRegister />
			</body>
		</html>
	);
}
