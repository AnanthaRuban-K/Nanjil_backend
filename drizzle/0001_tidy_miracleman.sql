ALTER TABLE "bookings" ADD COLUMN "service_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "invoice_number" varchar(30) NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_number_unique" UNIQUE("invoice_number");