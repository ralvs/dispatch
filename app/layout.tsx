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
		// Two sizes so a tab doesn't downscale the 192 and mush the chevron.
		icon: [
			{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
			{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
		],
		apple: "/icons/apple-touch-icon-180.png",
	},
};

export const viewport: Viewport = {
	// Follows the OS color-scheme preference. The in-app toggle is a
	// cookie-driven data-theme override applied after hydration, so browser
	// chrome and canvas can disagree when the user overrides the OS
	// preference — a known, accepted limitation of a static viewport export.
	themeColor: [
		{ media: "(prefers-color-scheme: dark)", color: "#1a1817" },
		{ media: "(prefers-color-scheme: light)", color: "#fafafa" },
	],
	viewportFit: "cover",
};

// Runs before paint so Cache Components can keep the root layout free of
// cookies() while still avoiding a theme flash (docs/adr/0033).
// Light is the default and dark is the opt-in peer, so the cookie is tested
// for "dark" and everything else falls to light — the inverse of what this
// script did before the revision-A token port (app/globals.css).
const THEME_BOOT = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]*)/);var t=m&&decodeURIComponent(m[1])==="dark"?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

/*
 * Standalone shell height. Installed on iOS, CSS viewport units cannot be
 * trusted: they resolve against a viewport that already has the safe areas
 * taken out, and they go stale until an unrelated reflow (opening the keyboard
 * and closing it) forces a recompute — the app was short at the bottom, then
 * randomly correct. So measure instead, before paint, and re-measure on every
 * event that can change it.
 *
 * `navigator.standalone` is the signal that actually works on iOS home-screen
 * apps; the media query covers every other installed platform. When the app
 * fills the screen (innerWidth matches screen.width, so not iPad split view)
 * screen.height is the floor — that is what makes this immune to iOS handing
 * back an inset-subtracted innerHeight too. Portrait-locked by the manifest,
 * and iOS reports screen dimensions unswapped, so landscape falls back to
 * innerHeight on its own.
 */
const SHELL_BOOT = `(function(){try{var d=document.documentElement;var s=navigator.standalone===true||matchMedia("(display-mode: standalone)").matches;if(!s)return;d.setAttribute("data-standalone","");var set=function(){var h=window.innerHeight;if(window.innerWidth===screen.width&&screen.height>h)h=screen.height;d.style.setProperty("--app-h",h+"px");};set();addEventListener("resize",set);addEventListener("orientationchange",set);addEventListener("pageshow",set);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable}`}>
			<head>
				{/* Static boot only — no user input. Required so root layout can stay
				 * cookie-free under Cache Components (docs/adr/0033). */}
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: fixed theme boot script, not user content */}
				<script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: fixed shell-height boot script, not user content */}
				<script dangerouslySetInnerHTML={{ __html: SHELL_BOOT }} />
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
