// Service worker for Web Push (ADR-0005) plus Phase 8 offline/caching: a
// precached offline fallback for failed navigations and a cache-first pass
// for Next's static build assets. Never caches authed HTML or /api/*.

const CACHE_VERSION = "v1";
const PRECACHE = `${CACHE_VERSION}-precache`;
const STATIC = `${CACHE_VERSION}-static`;

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(PRECACHE)
			.then((cache) => cache.addAll(["/offline.html"]))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key)),
				),
			)
			.then(() => clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;

	if (request.mode === "navigate") {
		event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
		return;
	}

	const { pathname } = new URL(request.url);
	if (pathname.startsWith("/_next/static/")) {
		event.respondWith(
			caches.open(STATIC).then((cache) =>
				cache.match(request).then((cached) => {
					if (cached) return cached;
					return fetch(request).then((response) => {
						cache.put(request, response.clone());
						return response;
					});
				}),
			),
		);
		return;
	}

	// Everything else (authed HTML fragments, /api/*, cross-origin) — default
	// network behavior, no cache involvement.
});

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
