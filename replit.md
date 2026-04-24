# PesaGate — M-Pesa Payment Gateway

## Overview

A full M-Pesa payment gateway platform built on Daraja API. Merchants register, get API keys, configure their settlement accounts (till or paybill), and use those keys to trigger STK Push payments from their own applications.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS

## Architecture

### Artifacts
- `artifacts/portal` — React frontend merchant dashboard (port: 25265, path: `/`)
- `artifacts/api-server` — Express backend API (path: `/api`)

### Libraries
- `lib/db` — Drizzle ORM schema + PostgreSQL client
- `lib/api-spec` — OpenAPI spec + codegen config
- `lib/api-client-react` — Generated React Query hooks
- `lib/api-zod` — Generated Zod validation schemas

## Database Schema

- **users** — Merchant accounts (email, passwordHash, businessName)
- **sessions** — Auth sessions (token-based, 30-day expiry)
- **api_keys** — Merchant API keys (publicKey + secretKey pairs)
- **settlement_accounts** — Till or Paybill settlement destinations
- **transactions** — STK Push payment records with M-Pesa callback data

## M-Pesa Integration

**Credentials (stored as secrets):**
- `MPESA_CONSUMER_KEY` — Daraja consumer key
- `MPESA_CONSUMER_SECRET` — Daraja consumer secret
- `MPESA_PASSKEY` — STK Push passkey
- `MPESA_SHORTCODE` — Business short code (4565915)

**Flow:**
1. Merchant registers → gets API keys
2. Merchant adds settlement account (till/paybill)
3. Client calls `POST /api/payments/stkpush` with `X-API-Key` header
4. Server calls Daraja STK Push → Safaricom sends OTP to customer
5. Customer confirms on phone → Safaricom calls `/api/payments/callback`
6. Transaction status updated in DB

**Callback URL:** Auto-detected from `REPLIT_DOMAINS` or `REPLIT_DEV_DOMAIN`

> Note: Currently configured for Daraja sandbox. Change `MPESA_BASE_URL` in `artifacts/api-server/src/lib/mpesa.ts` to `https://api.safaricom.co.ke` for production.

## Portal Pages

- `/login` — Sign in
- `/register` — Create merchant account
- `/dashboard` — Stats overview + recent transactions
- `/transactions` — Full transaction history with status filters
- `/api-keys` — Manage API keys (create/revoke)
- `/settlement` — Manage till/paybill settlement accounts
- `/docs` — Integration documentation

## Auth

Token-based (no Clerk). `POST /api/auth/login` returns a bearer token stored in localStorage. All portal API calls include `Authorization: Bearer <token>`.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Client Integration Example

```bash
# Initiate STK Push
curl -X POST https://your-domain/api/payments/stkpush \
  -H "X-API-Key: sk_your_secret_key" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254712345678",
    "amount": 100,
    "accountReference": "INV-001",
    "transactionDesc": "Payment for services"
  }'
```
