# Notifications are Web Push to the installed PWA, not Pushover

Reminders, the daily summary, and missed-routine alerts are delivered as Web
Push (VAPID keys, `web-push`, `public/sw.js`, `push_subscriptions` table)
straight to the installed PWA, deep-linking into the app. The reference's
Pushover integration is not ported.

## Why

Pushover is a third-party account, a $5 app, and another API token to babysit
— to deliver notifications *about* an app the phone already has installed.
iOS has supported PWA push since 16.4. Self-owned keys, no vendor, and taps
land inside Dispatch instead of a separate inbox. Cost: a service worker, a
subscribe flow, and pruning dead subscriptions (404/410) on send.
