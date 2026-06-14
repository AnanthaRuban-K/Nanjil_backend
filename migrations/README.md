# Manual Migrations

Manual migrations are for existing databases that predate the generated Drizzle
baseline.

## Existing DB UPI Payment Flow

Run:

```bash
npm run db:migrate:existing-upi
```

This executes:

```text
migrations/manual/20260614_upi_payment_flow_existing_db.sql
```

Use this instead of the generated `drizzle/0000_sour_ink.sql` when production
already has the original tables.

It also backfills invoice numbers for any existing payment rows before making
`payments.invoice_number` required.
