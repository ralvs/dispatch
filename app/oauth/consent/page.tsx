import type { Metadata } from "next";
import { ConsentView } from "./consent-view";

export const metadata: Metadata = { title: "Connect an assistant" };

/**
 * Supabase Auth's OAuth 2.1 server sends the owner here when an MCP client
 * asks to connect (docs/adr/0079). Reached signed out by definition, so
 * proxy.ts keeps it out of its matcher: a redirect to /sign-in would drop the
 * authorization_id and strand the client.
 */
export default function OAuthConsentPage() {
	return <ConsentView />;
}
