"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const SignInSchema = z.object({
	email: z.email(),
	password: z.string().min(1, "Password is required"),
});
type SignInValues = z.infer<typeof SignInSchema>;

export default function SignInPage() {
	const router = useRouter();
	const [serverError, setServerError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<SignInValues>({ resolver: zodResolver(SignInSchema) });

	async function onSubmit(values: SignInValues) {
		setServerError(null);
		const supabase = createBrowserSupabase();
		const { error } = await supabase.auth.signInWithPassword(values);
		if (error) {
			setServerError(error.message);
			return;
		}
		// Refresh so server components re-render with the new session.
		router.push("/today");
		router.refresh();
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
						className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-line-strong"
						{...register("email")}
					/>
					{errors.email && <p className="mt-1 text-meta text-error">{errors.email.message}</p>}
				</div>

				<div>
					<label htmlFor="password" className="font-mono text-eyebrow uppercase text-ink-3">
						Password
					</label>
					<input
						id="password"
						type="password"
						autoComplete="current-password"
						className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-line-strong"
						{...register("password")}
					/>
					{errors.password && (
						<p className="mt-1 text-meta text-error">{errors.password.message}</p>
					)}
				</div>

				{serverError && <p className="text-meta text-error">{serverError}</p>}

				<button
					type="submit"
					disabled={isSubmitting}
					className="w-full rounded-full bg-ink px-4 py-2.5 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
				>
					{isSubmitting ? "Signing in…" : "Enter"}
				</button>
			</form>
		</main>
	);
}
