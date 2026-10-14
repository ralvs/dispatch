-- A ledger row records an action, not its undo (docs/adr/0093). The code
-- stopped writing and reading undo_payload in an earlier deploy, so the
-- column can go.
alter table public.notifications drop column undo_payload;
