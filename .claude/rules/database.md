# Database rules

- Schema in `src/server/db/schema.ts` only; generate SQL with `pnpm db:generate`, never hand-write DDL except RLS migrations.
- Every new table: follow-up migration with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` and no policies.
- Use `timestamptz`, `uuid` PKs, explicit `onDelete`.
- Idempotent writes use `onConflictDoNothing/Update` on unique keys (`deliveries.comment_id`).
- Migrations must run on Postgres 15+ and be safe to apply on a populated DB (add columns nullable or with defaults).
- Use the transaction pooler at runtime: no session state, no `LISTEN`, prepared statements disabled in `client.ts`.
