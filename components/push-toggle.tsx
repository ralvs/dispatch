"use client";

import { useEffect, useState } from "react";
import { toastError } from "@/lib/client/toast";

// ─────────────────────────────────────────────────────────────────────────
// Web Push subscribe/unsubscribe toggle (ADR-0005). Single-user app: there's
// exactly one subscription to manage from this device/browser at a time.
// ─────────────────────────────────────────────────────────────────────────

type Status = "checking" | "unsupported" | "subscribed" | "unsubscribed";

function base64UrlToUint8Array(base64Url: string): Uint8Array {
	const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
	const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(base64);
	const bytes = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
	return bytes;
}

async function getExistingSubscription(): Promise<PushSubscription | null> {
	if (!("serviceWorker" in navigator)) return null;
	const registration = await navigator.serviceWorker.getRegistration("/sw.js");
	if (!registration) return null;
	return registration.pushManager.getSubscription();
}

export function PushToggle() {
	const [status, setStatus] = useState<Status>("checking");
	const [busy, setBusy] = useState(false);
	const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

	useEffect(() => {
		let cancelled = false;

		async function check() {
			if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
				if (!cancelled) setStatus("unsupported");
				return;
			}
			const existing = await getExistingSubscription();
			if (!cancelled) setStatus(existing ? "subscribed" : "unsubscribed");
		}

		check();
		return () => {
			cancelled = true;
		};
	}, [vapidPublicKey]);

	async function subscribe() {
		if (!vapidPublicKey) return;
		setBusy(true);
		try {
			const registration = await navigator.serviceWorker.register("/sw.js");
			const permission = await Notification.requestPermission();
			if (permission !== "granted") {
				setStatus("unsubscribed");
				return;
			}

			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: base64UrlToUint8Array(vapidPublicKey) as BufferSource,
			});

			const json = subscription.toJSON();
			await fetch("/api/push", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					endpoint: json.endpoint,
					keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
				}),
			});

			setStatus("subscribed");
		} catch {
			toastError("Couldn't enable push notifications.");
		} finally {
			setBusy(false);
		}
	}

	async function unsubscribe() {
		setBusy(true);
		try {
			const existing = await getExistingSubscription();
			if (existing) {
				const endpoint = existing.endpoint;
				await existing.unsubscribe();
				await fetch("/api/push", {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ endpoint }),
				});
			}
			setStatus("unsubscribed");
		} catch {
			toastError("Couldn't disable push notifications.");
		} finally {
			setBusy(false);
		}
	}

	if (status === "checking") return null;

	if (status === "unsupported") {
		return (
			<p className="font-mono text-meta text-ink-4">
				Push notifications aren't configured for this browser.
			</p>
		);
	}

	const subscribed = status === "subscribed";

	return (
		<button
			type="button"
			aria-label={subscribed ? "Turn off push notifications" : "Turn on push notifications"}
			disabled={busy}
			onClick={subscribed ? unsubscribe : subscribe}
			className="inline-flex h-9 items-center rounded-control border border-line px-3 font-mono text-meta text-ink-3 transition-opacity hover:border-ink hover:text-ink active:opacity-70 disabled:opacity-50"
		>
			{subscribed ? "Disable push notifications" : "Enable push notifications"}
		</button>
	);
}
