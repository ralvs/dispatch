# Read-only finance through Meu Pluggy

Date: 2026-11-15

An assistant should be able to answer questions about the owner's own money —
the Nubank checking account and credit card — from the same MCP connector
that already reads tasks, notes and the calendar (docs/adr/0079). Pluggy's
free personal-use route, Meu Pluggy with the MeuPluggy connector, exposes
those accounts through Open Finance. The reference implementation has no
finance surface, so this is a new direction.

## Decision

1. **Tools on the existing `/api/mcp`, not a second server.** Five read-only
   tools, prefixed `finance_` because they share a server with other domains:
   `finance_connection_status`, `finance_list_accounts`,
   `finance_get_transactions`, `finance_get_credit_card_bills`,
   `finance_spending_summary`. They sit behind `requireOwnerBearer()` like
   every other tool (iron rule #2), so no separate static bearer token exists.
   They register only when `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` and
   `PLUGGY_ITEM_IDS` are set.
2. **Stateless and read-only.** No table, no cache beyond the Pluggy API key
   in memory, nothing written. `lib/pluggy/client.ts` wraps `POST /auth` and
   GET reads only: `/items/{id}`, `/accounts`, `/v2/transactions`, `/bills`.
   No write, payment or Pix endpoint is wrapped, and none may be. Because no
   tool acts, iron rule #6 has nothing to record.
3. **No polling.** Meu Pluggy syncs each bank once a day and its items cannot
   be updated through the API; Pluggy forbids batch refresh loops. Every tool
   reads on demand and says the data is up to about a day old.
4. **Item ids are configuration.** `GET /v2/items` is not available to Meu
   Pluggy accounts, so `PLUGGY_ITEM_IDS` lists them (`nubank:<uuid>,…`).
5. **The API key** lives two hours. The client caches it per process, mints a
   new one ten minutes early, shares one mint between parallel reads, and
   mints once more and retries once on a 401.
6. **Transactions use `/v2/transactions`**, cursor-paged. `GET /transactions`
   is retired on 2026-12-31. Only the `after` value is taken from `next`, so
   our own filters ride on every page.
7. **Dates (iron rule #1).** Tools take and return `YYYY-MM-DD` in the app
   timezone. Pluggy sends day-only values as midnight UTC or without a zone;
   those keep their day (`localDay` in `lib/pluggy/format.ts`). Real instants
   are converted. Pluggy is asked for one extra day on each side, then rows
   are kept by local day.
8. **Spending excludes money that only moved between the owner's pockets.**
   `finance_spending_summary` leaves out of its groups and totals:
   - transfers between own accounts: category `Same person transfer…`, or
     payer and receiver with the same document number;
   - credit-card bill payments: category `Credit card payment`; a bank
     debit described `Pagamento de fatura` (Pluggy files Nubank's under
     `Transfers`, seen in live data); or the `Pagamento recebido` credit
     Nubank books on the card.
   Each card purchase counts once, as an outflow on the card; the bill
   payment from checking would count it a second time. Excluded rows come
   back under `excluded` with counts and totals, never dropped silently.
   Pending and posted rows both count. Amounts are unsigned BRL, using
   `amountInAccountCurrency` for foreign purchases. A row's `type` says
   which way the money went; without it the sign does, read per account: a
   bank books money out as negative, a card books a purchase as positive.
9. **Personal data stays at the edge.** The zod schemas strip every field the
   tools do not show; `paymentData` documents are read only to spot an own
   transfer and are never returned. Account and card numbers come back as
   the last four digits, and so does any run of eight or more digits inside
   a description or merchant name (a CPF or account number in a Pix text).
   Errors name the method, path and status, never a query string, body or
   key.

## Consequences

- The MeuPluggy authorization lasts a year. After that, reads come back empty
  and the item may still say `UPDATED` until its next sync fails with
  `USER_AUTHORIZATION_EXPIRED`. `finance_connection_status` warns from 30 days
  out and on an empty read. Renewal is manual (README), and the item id may
  change, so `PLUGGY_ITEM_IDS` must be checked after it.
- Pluggy's category names are matched as text. If Pluggy renames
  `Same person transfer` or `Credit card payment`, bill payments would count
  as spending again; `excluded` going to zero is the visible sign.
- Free tier: at most five connections, personal use only.
