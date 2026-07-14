import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	// Server Actions default to a 1MB body cap — fine for forms, fatal for
	// phone photos posted through upload actions. Match the reference's 25MB.
	experimental: {
		serverActions: {
			bodySizeLimit: "25mb",
		},
	},
};

export default nextConfig;
