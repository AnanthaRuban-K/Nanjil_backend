-- Safe migration for an existing Nanjil MEP PostgreSQL database.
-- Use this when the tables already exist and you only need the UPI
-- payment-submission fields/statuses added by the app update.

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'PAYMENT_SUBMITTED';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'PAYMENT_REJECTED';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS submitted_upi_reference varchar(100),
  ADD COLUMN IF NOT EXISTS payment_submitted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS payment_rejected_reason text,
  ADD COLUMN IF NOT EXISTS service_amount numeric(10, 2);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS invoice_number varchar(30);

WITH numbered_payments AS (
  SELECT
    id,
    'NMI-LEGACY-' || row_number() OVER (ORDER BY created_at, id)::text AS invoice_number
  FROM payments
  WHERE invoice_number IS NULL
)
UPDATE payments
SET invoice_number = numbered_payments.invoice_number
FROM numbered_payments
WHERE payments.id = numbered_payments.id;

ALTER TABLE payments
  ALTER COLUMN invoice_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_invoice_number_unique'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_invoice_number_unique UNIQUE (invoice_number);
  END IF;
END $$;
