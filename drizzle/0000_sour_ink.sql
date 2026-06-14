CREATE TYPE "public"."booking_status" AS ENUM('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('UNPAID', 'PAYMENT_SUBMITTED', 'PAID', 'PAYMENT_REJECTED');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('CASH', 'UPI');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'TECHNICIAN', 'CUSTOMER');--> statement-breakpoint
CREATE TABLE "booking_status_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"from_status" "booking_status",
	"to_status" "booking_status" NOT NULL,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_reference" varchar(20) NOT NULL,
	"customer_id" uuid NOT NULL,
	"technician_id" uuid,
	"service_type" varchar(100) NOT NULL,
	"issue_description" text NOT NULL,
	"service_address" text NOT NULL,
	"preferred_date" date NOT NULL,
	"scheduled_date" date,
	"status" "booking_status" DEFAULT 'PENDING' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'UNPAID' NOT NULL,
	"submitted_upi_reference" varchar(100),
	"payment_submitted_at" timestamp with time zone,
	"payment_rejected_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_booking_reference_unique" UNIQUE("booking_reference")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_mode" "payment_mode" NOT NULL,
	"upi_reference" varchar(100),
	"recorded_by" uuid NOT NULL,
	"payment_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(15) NOT NULL,
	"hashed_password" text NOT NULL,
	"role" "user_role" DEFAULT 'CUSTOMER' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "booking_status_logs" ADD CONSTRAINT "booking_status_logs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_logs" ADD CONSTRAINT "booking_status_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_status_logs_booking_id" ON "booking_status_logs" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_customer_id" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_technician_id" ON "bookings" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_status" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bookings_created_at" ON "bookings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_payments_booking_id" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_payments_payment_date" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_payments_payment_mode" ON "payments" USING btree ("payment_mode");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");