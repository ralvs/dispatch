# Note attachments live in R2, behind a proxy route

Date: 2026-08-18

Notes were text-only. Most of what Renan wants to keep in a note is a photo or
a PDF, plus the occasional `.md`, and there was nowhere to put one.

## Context

Some of the groundwork was already here and had never been used. It arrived in
`9868748`, the first substantive commit, ported from the reference
implementation and never wired up:

- `notes.attachments` jsonb + a GIN index (`20260714194155_schema.sql:387,398`)
- `AttachmentSchema` (`lib/schemas/note.ts`)
- a private `media` Supabase Storage bucket (`20260714210345_storage.sql`)
- the 25MB Server Action cap in `next.config.ts`, whose comment names phone
  photos explicitly

`lib/schemas/note.ts` recorded the one time a session looked at the column and
deliberately left it out of both selects. So this is unused scaffolding, not a
retry of something that failed.

## Decision

### Files sit beside the note, not inside its text

Attachments live in `notes.attachments`; the markdown body is never touched.
Iron rule #5 keeps the body verbatim, and the TipTap markdown round-trip is
already delicate — `ParagraphKeepBlank` in `note-editor.tsx` exists because
blank lines and adjacent lists were being silently mangled on save. Adding an
image node with its own serialize/parse pair would put new failure modes on
that path in exchange for inline photos.

It also makes one code path serve all three file types. A PDF has no inline
markdown representation; only a link. Going inline would have meant two systems.

`note-editor.tsx` is untouched by this change.

### The bytes went to Cloudflare R2, not the Supabase bucket

Supabase's free tier gives 1 GB of storage and 5 GB of egress per month. R2's
free tier gives 10 GB and charges nothing for egress, and its S3 API keeps the
data portable.

The usual reason to keep storage next to the database — one service, local dev
parity — does not apply: `supabase/` holds migrations only, with no
`config.toml`, so development already runs against the hosted project. The
unused `media` bucket and its migration are left in place; deleting them would
rewrite history for nothing.

### Everything is read through `/api/media`, and that is what keeps it portable

The bucket is private, with no public access and no custom domain. The app
fetches each object server-side under `ownerRoute` and streams it back.

Three things fall out of that one decision:

1. **No CORS, no public bucket, no custom domain to configure.** The browser
   only ever talks to this app.
2. **No signed URLs.** They expire, and `/notes` is served from a cross-request
   `"use cache"` entry — a signed URL baked into that cache would rot inside it.
3. **Nothing in Postgres names a storage provider.** The persisted `url` is
   `/api/media/<key>`, ours. Changing provider again cannot invalidate a stored
   row.

Keys are `notes/<noteId>/<uuid>.<ext>` and the response carries
`Cache-Control: private, max-age=31536000, immutable` — content at a key never
changes, so re-reading a note does not spend egress twice.

The client filename never enters the key; it is kept as `name` metadata. A
route-level pattern check rejects anything that is not a note attachment key.

### Images are downscaled on upload and the original is discarded

Long edge capped at 2400px, re-encoded to webp. Measured on a real 4000×3000
photo: 870 KB → 122 KB. That is the difference between a few hundred photos and
a few thousand inside the free 10 GB, and it is why `/api/media` can cache so
aggressively.

Accepted knowingly: full-resolution originals are unrecoverable. `sharp`'s
`.rotate()` applies the EXIF orientation tag (so phone photos are not sideways)
and strips metadata as a side effect — which is why `AttachmentSchema`'s
`gps`/`location` fields stay unpopulated. GIFs pass through untouched, since
resizing flattens the animation.

### Storage sits behind a four-function port

`lib/storage/` exposes `putObject` / `getObject` / `deleteObjects` /
`listPrefix` and nothing else; `lib/storage/r2.ts` is the only module that
knows about R2. `key` is a plain slash-separated string, valid in R2, S3, and
Supabase Storage alike.

`aws4fetch`, not `@aws-sdk/client-s3`: this is four HTTP calls, and the AWS SDK
is megabytes of cold-start cost for them.

### The jsonb array is mutated by RPC

`note_attachment_add` and `note_attachment_remove` are `security invoker` SQL
functions using `||` and a filtered `jsonb_agg`. Appending in application code
would be a read-modify-write, and two uploads landing together would lose one —
ADR-0037 applied to a jsonb array.

### The whole note is the drop target

Dropping a photo onto the middle of your text is the gesture people actually
make, so `attachment-strip.tsx` wraps the editor rather than sitting under it.
The handlers are capture-phase, which is what stops the event reaching
ProseMirror and is the mechanism that keeps `note-editor.tsx` unmodified.
Pasting a screenshot goes through the same path.

## Consequences

Two failure modes are ordered rather than prevented, because they are not
symmetrical:

- **Upload** writes bytes first, then the row, and deletes the object if the
  row write fails. An object with no row is invisible garbage; a row with no
  object is a broken thumbnail.
- **Removal** deletes the row first, then the bytes. Same reasoning mirrored.
  `deleteNote` sweeps the whole `notes/<id>/` prefix best-effort, after the row
  is gone — an R2 hiccup must not resurrect a note the user deleted.

Partial success is a real outcome the UI has to state: dropping five files
where one is a `.zip` attaches four and names the one it refused.

Two things only the real service could have taught us, both found in browser
verification and neither visible to mocked tests:

- **R2 rejects a chunked PUT with `411 MissingContentLength`.** Whether `fetch`
  sets the header depends on body type *and* runtime — a `Uint8Array` works
  under Node while a `Buffer` or `Blob` does not, and Bun differs from Node
  again. `putObject` sets `Content-Length` explicitly rather than depending on
  any of that.
- **aws4fetch retries 5xx ten times with exponential backoff by default**,
  about 51 seconds inside a request someone is watching. Capped at 2.

`sharp` moves from `devDependencies` to `dependencies` — it now runs at request
time, and a devDependency is not installed in a Vercel production build.

Not done here: EXIF GPS and reverse geocoding, attachments on `journal_entries`
(the column exists there too), and attachments in the capture pipeline — iron
rule #4 keeps capture text-only.
