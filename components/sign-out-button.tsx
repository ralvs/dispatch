"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function SignOutButton() {
	const router = useRouter();

	async function signOut() {
		await createBrowserSupabase().auth.signOut();
		router.push("/sign-in");
		router.refresh();
	}

	return (
		<button
			type="button"
			onClick={signOut}
			className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-accent"
		>
			Sign out
		</button>
	);
}
