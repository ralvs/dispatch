import { defineConfig, devices } from "@playwright/test";
import { AUTH_FILE } from "./test/e2e/paths";
import { OWNER_USER_ID, readLocalStack } from "./test/integration/stack";

// The end-to-end layer (docs/adr/0063): the production build against the local
// Supabase stack, never the hosted project. `readLocalStack` refuses any
// non-local host. Every key below is set explicitly, even to "": Next fills a
// key from .env.local only when it is undefined, so a listed key can never pick
// up a production value from a stray .env.local (the main checkout has one).
const stack = readLocalStack();
const PORT = 3300;

export default defineConfig({
	testDir: "test/e2e",
	testMatch: /.*\.(spec|setup)\.ts$/,
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	reporter: "list",
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: "retain-on-failure",
	},
	projects: [
		{ name: "setup", testMatch: /.*\.setup\.ts$/ },
		{
			name: "chromium",
			testMatch: /.*\.spec\.ts$/,
			use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
			dependencies: ["setup"],
		},
	],
	webServer: {
		command: `next build && next start -p ${PORT}`,
		url: `http://localhost:${PORT}/sign-in`,
		// Never reuse: a server already on this port is not this build.
		reuseExistingServer: false,
		timeout: 300_000,
		stdout: "pipe",
		env: {
			NEXT_PUBLIC_SUPABASE_URL: stack.apiUrl,
			NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: stack.publishableKey,
			SUPABASE_SECRET_KEY: stack.secretKey,
			OWNER_USER_ID,
			// Every integration is off. "" reads as unset (lib/env.ts), so
			// isAiConfigured() is false and no server path calls the gateway — the
			// same as the integration layer. Never delete a key here: an undefined
			// key would be filled from .env.local. The smoke also blocks the gateway
			// host in the browser.
			AI_GATEWAY_API_KEY: "",
			CAPTURE_WEBHOOK_SECRET: "",
			CRON_SECRET: "",
			WIDGET_SECRET: "",
			CALENDAR_BRIDGE_SECRET: "",
			ICLOUD_USERNAME: "",
			ICLOUD_APP_PASSWORD: "",
			ICLOUD_CALENDAR_NAME: "",
			NEXT_PUBLIC_VAPID_PUBLIC_KEY: "",
			VAPID_PRIVATE_KEY: "",
			MEM_API_KEY: "",
			R2_ACCOUNT_ID: "",
			R2_ACCESS_KEY_ID: "",
			R2_SECRET_ACCESS_KEY: "",
			R2_BUCKET: "",
		},
	},
});
