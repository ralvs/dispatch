"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Field, Input } from "@/components/ui";
import { browserAuth } from "@/lib/supabase/browser";

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

/**
 * The owner's email-and-password form, shared by /sign-in and the OAuth
 * consent page (docs/adr/0079). Where to go next is the caller's call:
 * /sign-in goes to Today, consent goes on to the authorization request.
 */
export function SignInForm({ onSignedIn }: { onSignedIn: () => void | Promise<void> }) {
	const [serverError, setServerError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<SignInValues>({ resolver: zodResolver(SignInSchema) });

	async function onSubmit(values: SignInValues) {
		setServerError(null);
		const { error } = await browserAuth().signInWithPassword(values);
		if (error) {
			setServerError(mapSignInError(error.message));
			return;
		}
		await onSignedIn();
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-7" noValidate>
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
				<p role="alert" className="text-sm text-error">
					{serverError}
				</p>
			)}

			<Button
				type="submit"
				variant="primary"
				shape="pill"
				fullWidth
				size="md"
				isPending={isSubmitting}
				disabled={isSubmitting}
			>
				{isSubmitting ? "Signing in…" : "Sign in"}
			</Button>
		</form>
	);
}
