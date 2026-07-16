import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const newsreader = Newsreader({
	subsets: ["latin"],
	style: ["normal", "italic"],
	variable: "--font-newsreader",
});

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
	// Matched to the dark theme; the light value ships with the theme toggle.
	themeColor: "#16130F",
	viewportFit: "cover",
	maximumScale: 1,
	userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";

	return (
		<html
			lang="en"
			data-theme={theme}
			className={`${newsreader.variable} ${geist.variable} ${geistMono.variable}`}
		>
			<body>{children}</body>
		</html>
	);
}
