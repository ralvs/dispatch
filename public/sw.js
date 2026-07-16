// Minimal service worker for Web Push (ADR-0005). No offline/caching behavior
// here — that's Phase 8 (PWA manifest/offline).

self.addEventListener("push", (event) => {
	let payload = { title: "Dispatch" };
	try {
		if (event.data) payload = event.data.json();
	} catch {
		// Non-JSON or missing payload — fall back to the generic title above.
	}

	const title = payload.title || "Dispatch";
	const options = {
		body: payload.body,
		data: { url: payload.url ?? "/" },
	};

	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = event.notification.data?.url ?? "/";

	event.waitUntil(
		clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if (client.url === url && "focus" in client) return client.focus();
			}
			if (clients.openWindow) return clients.openWindow(url);
		}),
	);
});
