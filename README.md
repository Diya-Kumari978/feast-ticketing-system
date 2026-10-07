# Feast ticketing

Event details and ticket pricing are maintained in [`lib/event-config.ts`](lib/event-config.ts). The registration page, admin settings, ticket pages, and database writes use that configuration.

## Local setup

1. Install Node.js 20.9 or newer and run `npm install`.
2. Copy `.env.example` to `.env.local`.
3. In Supabase, run `001_initial.sql`, followed by migrations `002_manual_payment_review.sql`, `003_remove_transaction_id.sql`, and `004_event_ticket_price.sql` in order. If 001 is already installed, do not run it again.
4. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, a 32+ character `SESSION_SECRET`, and the payment receiving-account details in `.env.local`.
5. Run `npm run dev` and open `http://localhost:3000`.

The participant registration form accepts a payment screenshot and does not request a transaction ID. The admin approves or rejects submissions after checking the actual payment account history.

Admin credentials are fixed in the server-only file `lib/admin-credentials.ts`. The session signing secret remains in `.env.local`.

## Checks

```bash
npm test
npm run lint
npm run build
```

## Vercel

Configure the same server-side and payment account variables in Vercel, apply all Supabase migrations, and deploy. Camera scanning requires HTTPS.
