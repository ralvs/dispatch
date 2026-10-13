# Accepting a note file is one module; tests fake the storage port

Date: 2026-10-13

The rule for what may become a note attachment (size, empty, type, sniff,
downscale) lived inside the attachments route, beside the batch loop, the
note check and the read-back. Testing it meant driving the route with six
module mocks. The attachment strip restated the picker's accept list as its
own string and cast the route's JSON to a write type by hand. And three test
files each module-mocked the same four functions of `@/lib/storage`, so a
test that forgot the mock reached for the real bucket.

## Decision

1. **`lib/services/note-files.ts` owns intake.** `vetNoteFile(file)` is the
   rule, with no storage and no database. `attachNoteFiles(sb, noteId, files)`
   checks the note, vets and uploads one file at a time in order, and builds
   the reply. It is its own module because it reads the note back, and
   `notes` already imports `note-attachments`.
2. **`lib/attachments.ts` owns the shared shapes**: `ATTACHMENT_ACCEPT`,
   `ALLOWED_CONTENT_TYPES`, `FileRejection`, `AttachFilesReply` and
   `AttachFilesRefusal`. It stays client-safe and imports types only.
3. **The route only translates HTTP**: owner, id, storage configured,
   multipart, files present, then the module's answer as a status.
4. **Storage functions take `{ storage?: StoragePort }`**, defaulting to the
   `storage` value exported by `lib/storage`. Tests pass
   `test/fakes/storage.ts`, an in-memory port whose methods are `vi.fn`.
5. **No test module-mocks `@/lib/storage`**, except a route handler with no
   seam (`/api/media`). Both test setups delete the `R2_*` variables, so a
   forgotten injection throws "R2 is not configured" rather than reaching the
   bucket.

## Consequences

- The intake rule is unit-tested against real bytes and real sharp, with no
  mocks.
- The route test mocks only auth, env, invalidate and the module.
- The strip's accept list and reply type come from one place, and a test
  checks the accept list covers every allowed type.
- ADR-0076 (the parser takes its model) applied to storage.
