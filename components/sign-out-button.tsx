"use client";

import { useRouter } from "next/navigation";
import { toastError } from "@/lib/client/toast";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function SignOutButton() {
	const router = useRouter();

	async function signOut() {
		try {
			await createBrowserSupabase().auth.signOut();
			router.push("/sign-in");
			router.refresh();
		} catch {
			toastError("Couldn't sign out. Try again.");
		}
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
