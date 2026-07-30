"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
				<p className="font-mono text-eyebrow uppercase text-ink-3">Dispatch</p>
				<p className="mt-4 font-serif text-ink-3" role="status">
					Checking session…
				</p>
			</main>
		);
	}

	return (
		<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-24">
			<p className="font-mono text-eyebrow uppercase text-ink-3">Dispatch</p>
			<h1 className="mt-1 font-serif text-3xl text-ink">Sign in</h1>
			<div className="hairline-strong mt-6" />

			<form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6" noValidate>
				<div>
					<label htmlFor="email" className="font-mono text-eyebrow uppercase text-ink-3">
						Email
					</label>
					<input
						id="email"
						type="email"
						autoComplete="email"
						aria-invalid={errors.email ? "true" : undefined}
						aria-describedby={errors.email ? "email-error" : undefined}
						className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink focus:border-line-strong"
						{...register("email")}
					/>
					{errors.email && (
						<p id="email-error" role="alert" className="mt-1 text-meta text-error">
							{errors.email.message}
						</p>
					)}
				</div>

				<div>
					<label htmlFor="password" className="font-mono text-eyebrow uppercase text-ink-3">
						Password
					</label>
					<input
						id="password"
						type="password"
						autoComplete="current-password"
						aria-invalid={errors.password ? "true" : undefined}
						aria-describedby={errors.password ? "password-error" : undefined}
						className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink focus:border-line-strong"
						{...register("password")}
					/>
					{errors.password && (
						<p id="password-error" role="alert" className="mt-1 text-meta text-error">
							{errors.password.message}
						</p>
					)}
				</div>

				{serverError && (
					<p role="alert" className="text-meta text-error">
						{serverError}
					</p>
				)}

				<button
					type="submit"
					disabled={isSubmitting}
					className="w-full rounded-full bg-ink px-4 py-2.5 font-mono text-eyebrow uppercase tracking-widest text-bg transition-opacity active:opacity-70 disabled:opacity-50"
				>
					{isSubmitting ? "Signing in…" : "Sign in"}
				</button>
			</form>
		</main>
	);
}
