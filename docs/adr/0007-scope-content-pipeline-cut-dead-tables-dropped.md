# The content pipeline is cut; tables the reference never wired are dropped

Dispatch does not port the YouTube/content-creation area: no `content_items`,
`content_checklist_items`, or `content_templates` tables, no `/content`
pages, no `update_content_item` voice action, no `tasks.content_item_id`
link, no `days_since_publish` cadence rule (14 voice actions remain; the tab
shell is 5 tabs). Also dropped: `email_rules`, `checklist_templates`,
`checklist_instances` (schema-only ghosts in the reference — its own README
says "exist unused"), and the health-document OCR columns. Domains keep
`days_since_journal`, `no_activity_days`, and the manual "Mark shipped"
stamp. Domains gain full create/edit/archive CRUD — the reference was
seed-only.

## Why

The reference was built for a content creator; this owner is a developer.
Porting someone else's half-built features is negative work: every dead table
is schema to migrate, RLS to reason about, and types to maintain. Anything cut
here can return later as a normal migration.
