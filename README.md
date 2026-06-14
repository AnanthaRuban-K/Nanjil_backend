# Nanjil MEP Backend

Hono + PostgreSQL + Drizzle backend for bookings, technicians, UPI payment verification, receipts, auth, and notifications.

## Local Setup

```bash
npm ci
```

Create `.env` from `.env.example`:

```bash
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/nanjil_mep
JWT_SECRET=<64+ character secret>
CORS_ORIGIN=http://localhost:4001
FRONTEND_URL=http://localhost:4001
```

Generate a JWT secret:

```bash
npm run secret:jwt
```

Run locally:

```bash
npm run dev
```

Health check:

```text
GET http://localhost:4000/api/v1/health
```

## Environment Guide

Required:

```text
PORT=4000
NODE_ENV=development | production | test
DATABASE_URL=postgresql://...
JWT_SECRET=<strong random secret>
CORS_ORIGIN=https://your-frontend-domain.com
FRONTEND_URL=https://your-frontend-domain.com
```

Optional:

```text
COOKIE_DOMAIN=.yourdomain.com
ADMIN_EMAILS=admin@example.com,owner@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASS=...
SMTP_FROM=Nanjil MEP <notifications@example.com>
```

Use `COOKIE_DOMAIN` only when frontend and backend are on subdomains such as `app.example.com` and `api.example.com`.

Never commit real `.env` files.

## Database Migration Guide

There are two migration paths. Pick one.

### Fresh Database

Use this only when the database has no Nanjil MEP tables:

```bash
npm run db:migrate
```

The generated Drizzle migrations are in `drizzle/`.

### Existing Database

Use this when the database already has the original tables:

```bash
npm run db:migrate:existing-upi
```

This applies:

- UPI payment statuses
- UPI submission fields
- service amount field
- payment invoice number field and backfill

Manual SQL:

```text
migrations/manual/20260614_upi_payment_flow_existing_db.sql
```

Do not run the generated baseline migration against an existing production database unless you have verified it will not recreate existing tables.

## Admin Seed Guide

Seed default admin users:

```bash
npm run seed:admin
```

Seed default technicians:

```bash
npm run seed:technicians
```

Default seed passwords are inside:

```text
scripts/seed-admin.ts
scripts/seed-technicians.ts
```

Change seeded passwords immediately after first login. For production, prefer creating technicians from the admin UI after the first admin account exists.

## Notifications

Events:

- Booking created -> admin emails
- Technician assigned -> technician email
- Completed/payment pending -> customer email
- Payment submitted -> admin emails

If SMTP is not configured, notifications are logged only and business actions still succeed.

## Smoke Test

Start the backend, then run:

```bash
npm run smoke:auth
```

Optional:

```bash
SMOKE_API_BASE_URL=http://localhost:4000/api/v1
SMOKE_EMAIL=smoke@example.com
SMOKE_PASSWORD=SmokeTest123!
```

The smoke test creates a customer and one booking. Use staging when possible.

## Verification

```bash
npm run typecheck
npm run build
npm test
```

## Deployment Guide

1. Rotate and set real secrets in the hosting platform.
2. Set `NODE_ENV=production`.
3. Set `CORS_ORIGIN` to the frontend origin.
4. Set `FRONTEND_URL` to the frontend app URL.
5. Set `COOKIE_DOMAIN` only if required for subdomains.
6. Run the correct database migration path.
7. Build:

```bash
npm ci
npm run build
```

8. Start:

```bash
npm start
```

Docker:

```bash
docker build -t nanjil-mep-backend .
docker run --env-file .env -p 4000:4000 nanjil-mep-backend
```

After deployment, run:

```bash
npm run smoke:auth
```
