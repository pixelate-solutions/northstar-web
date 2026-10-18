# Northstar

Free trip planner at [northstartravelguide.com](https://www.northstartravelguide.com): every day of the trip on one map, with an AI assistant (OpenAI `gpt-6-luna`) that edits the plan and can undo its changes.

- `src/` — Next.js 16 web app and JSON API (Clerk auth, Drizzle + Neon Postgres)
- `ios/` — native SwiftUI iPhone app (MapKit), same API and Clerk accounts

## Web

```bash
npm install
npm run dev        # uses .env.development.local, then .env.local
npm run lint
npm run build
```

Local development should point `DATABASE_URL` at a local Postgres (set it in `.env.development.local`). `drizzle.config.ts` prefers that file too, so `npm run db:migrate` targets the local database unless `DATABASE_URL` is set explicitly in the shell.

Secrets live in Infisical (project **Northstar**, environment `prod`) and Vercel (project `northstar`).

### Environment

```
DATABASE_URL
NEXT_PUBLIC_BASE_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
OPENAI_API_KEY
OPENWEATHER_API_KEY
```

### Tests

End-to-end tests use Playwright with a Clerk test user (`e2e+clerk_test@…`, credentials in `.env.e2e.local`):

```bash
npx playwright test                 # desktop + mobile against E2E_BASE_URL (default http://localhost:3001)
```

## API (used by the web app and iOS)

All routes accept Clerk session cookies or `Authorization: Bearer <Clerk session token>` and act on the user's active trip.

- `GET /api/me` — user and trips
- `GET /api/trip?tripId=` — full plan for the active trip (switches trip when `tripId` is given)
- `POST|PATCH|DELETE /api/events[/:id]`, `PATCH /api/events/reorder` — stops
- `PUT /api/days/:date`, `POST /api/days` — day details, trip dates
- `/api/packing`, `/api/reminders`, `/api/expenses` — lists and budget (PATCH only changes the fields sent)
- `GET /api/places?q=` — place search
- `POST /api/ai/chat` — NDJSON stream (`status`, `conversation`, `message_start`, `text_delta`, `cards`, `done`, `error`); `POST /api/ai/messages/:id/undo`
