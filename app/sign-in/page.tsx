"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Field, Input } from "@/components/ui";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const SignInSchema = z.object({
	email: z.email(),
	password: z.string().min(1, "Password is required"),
});
type SignInValues = z.infer<typeof SignInSchema>;

/** Maps the raw Supabase auth error to house copy — never leak provider wording. */
function mapSignInError(message: string): string {
	if (typeof navigator !== "undefined" && !navigator.onLine) {
		return "You're offline. Check your connection and try again.";
	}
	if (/invalid login credentials/i.test(message)) {
		return "Couldn't sign in. Check your email and password and try again.";
	}
	return "Couldn't sign in. Try again.";
}

export default function SignInPage() {
	const router = useRouter();
	const [serverError, setServerError] = useState<string | null>(null);
	// True until we know there is no recoverable browser session. Avoids a
	// flash of the form when cold-start recovery is about to redirect (ADR-0032).
	const [checkingSession, setCheckingSession] = useState(true);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<SignInValues>({ resolver: zodResolver(SignInSchema) });

	useEffect(() => {
		let cancelled = false;
		const supabase = createBrowserSupabase();

		// Cold-start path: proxy bounced us here because the *server* couldn't
		// prove ownership (expired access + concurrent refresh, or a brief
		// JWKS miss). The refresh cookie often still sits in document.cookie
		// and is still valid server-side (not revoked). One serial browser
		// refresh recovers it — password re-entry is the wrong fix.
		void (async () => {
			try {
				const { data, error } = await supabase.auth.getSession();
				if (cancelled) return;
				if (!error && data.session) {
					router.replace("/today");
					router.refresh();
					return;
				}
			} catch {
				// Fall through to the form — recovery is best-effort.
			}
			if (!cancelled) setCheckingSession(false);
		})();

		return () => {
			cancelled = true;
		};
	}, [router]);

	async function onSubmit(values: SignInValues) {
		setServerError(null);
		const supabase = createBrowserSupabase();
		const { error } = await supabase.auth.signInWithPassword(values);
		if (error) {
			setServerError(mapSignInError(error.message));
			return;
		}
		// Refresh so server components re-render with the new session.
		router.push("/today");
		router.refresh();
	}

	if (checkingSession) {
		return (
			<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-24">
				<p className="label">Dispatch</p>
				<p className="mt-4 font-serif text-ink-3" role="status">
					Checking session…
				</p>
			</main>
		);
	}

	return (
		<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-24">
			<p className="label">Dispatch</p>
			<h1 className="mt-1 font-serif text-3xl text-ink">Sign in</h1>
			<div className="hairline-strong mt-6" />

			<form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6" noValidate>
				<Field label="Email" error={errors.email?.message} htmlFor="email">
					<Input
						id="email"
						type="email"
						autoComplete="email"
						size="lg"
						invalid={Boolean(errors.email)}
						{...register("email")}
					/>
				</Field>

				<Field label="Password" error={errors.password?.message} htmlFor="password">
					<Input
						id="password"
						type="password"
						autoComplete="current-password"
						size="lg"
						invalid={Boolean(errors.password)}
						{...register("password")}
					/>
				</Field>

				{serverError && (
					<p role="alert" className="text-meta text-error">
						{serverError}
					</p>
				)}

				<Button
					type="submit"
					variant="primary"
					fullWidth
					size="lg"
					isPending={isSubmitting}
					disabled={isSubmitting}
				>
					{isSubmitting ? "Signing in…" : "Sign in"}
				</Button>
			</form>
		</main>
	);
}
