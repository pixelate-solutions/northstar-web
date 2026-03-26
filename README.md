# SW Road Trip '26

A full-stack Next.js 14 road trip planner for an 11-day Southwest itinerary from April 8–18, 2026:

Phoenix / Scottsdale → Sedona → Grand Canyon → Page → Zion → Bryce Canyon → Provo → Salt Lake City → Bonneville Salt Flats → Las Vegas → Scottsdale → Home

## Stack

- Next.js 14 App Router + TypeScript
- Tailwind CSS
- Neon PostgreSQL + Drizzle ORM
- React Leaflet + OpenStreetMap
- React Big Calendar
- DnD Kit
- React Hook Form + Zod
- Sonner
- Recharts

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env.local

# 3. Add your Neon connection string to .env.local
# DATABASE_URL=...

# 4. Generate and run database migrations
npm run db:generate
npm run db:migrate

# 5. Seed the database with trip data
npm run db:seed

# 6. Start development
npm run dev
```

## Environment Variables

```bash
DATABASE_URL=
NEXT_PUBLIC_BASE_URL=http://localhost:3000
OPENWEATHER_API_KEY=
```

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
```

## Notes

- If `DATABASE_URL` is empty, the UI still renders with fallback trip-day metadata so the app can build and preview locally.
- CRUD actions and seeded trip content require a configured Neon database and a completed seed run.
- Weather cards are optional and stay hidden until `OPENWEATHER_API_KEY` is set.

## Deploy

Deploy to Vercel after setting:

- `DATABASE_URL`
- `NEXT_PUBLIC_BASE_URL`
- `OPENWEATHER_API_KEY` (optional)
