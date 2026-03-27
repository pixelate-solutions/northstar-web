# Northstar

Northstar is a multi-tenant travel planning SaaS built with Next.js, Clerk, Neon, Drizzle, and Stripe.

The app now has:

- a public landing page at `/`
- account-based authentication with Clerk
- a paid app workspace under `/app`
- trip ownership scoped to the signed-in user
- multiple trips per account
- a built-in Southwest template that can be copied into user accounts
- Stripe-based lifetime access gating

## Stack

- Next.js 16 App Router + TypeScript
- Tailwind CSS
- Neon PostgreSQL + Drizzle ORM
- Clerk
- Stripe
- React Leaflet + OpenStreetMap
- React Big Calendar
- DnD Kit
- React Hook Form + Zod
- Sonner
- Recharts

## Setup

```bash
npm install
cp .env.example .env.local
```

Add the required environment variables:

```bash
DATABASE_URL=
NEXT_PUBLIC_BASE_URL=http://localhost:3000

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=

OPENWEATHER_API_KEY=
```

Then generate and apply the database changes:

```bash
npm run db:generate
npm run db:migrate
```

To seed a local demo account and starter trip:

```bash
npm run db:seed
```

Start development:

```bash
npm run dev
```

## Billing Flow

The current purchase flow is:

1. Sign up with Clerk
2. Enter the app
3. Hit the `/unlock` paywall
4. Complete Stripe Checkout
5. Unlock lifetime access

The success redirect and Stripe webhook both support granting access.

## Notes

- The old Southwest trip data is preserved as the built-in template source.
- `src/db/seed.ts` is now treated as template data input, while `src/db/seed-app.ts` handles demo seeding for the new schema.
- AI subscription features are not implemented yet; the data model is prepared for a paid core product first.
