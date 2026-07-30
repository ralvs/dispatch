import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

// Runs before paint so Cache Components can keep the root layout free of
// cookies() while still avoiding a theme flash (docs/adr/0033).
const THEME_BOOT = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]*)/);var t=m&&decodeURIComponent(m[1])==="light"?"light":"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable}`}>
			<head>
				{/* Static boot only — no user input. Required so root layout can stay
				 * cookie-free under Cache Components (docs/adr/0033). */}
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: fixed theme boot script, not user content */}
				<script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
			</head>
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
