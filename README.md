# Voyager

Voyager is a full-stack travel planning app built with Next.js.
Users type one natural-language query and get a unified trip view: flights, hotels, activities, dining, insights, and itinerary support.

## Why Voyager
- One search flow instead of multiple travel tabs
- Context-aware filtering and ranking
- AI assistant for trip Q&A and itinerary generation
- Fallback inventory behavior when upstream APIs are slow or unavailable

## Tech Stack
- Frontend: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- Backend: Next.js Route Handlers (`app/api/*`)
- Data providers: TBO (Hotels/Air), Google Places, Open-Meteo
- AI: Gemini-compatible API via `lib/ai.ts`

## Local Setup
1. Install dependencies:
```bash
npm install
```

2. Create local env file:
```bash
cp .env.example .env.local
```

3. Start dev server:
```bash
npm run dev
```

4. Open:
`http://localhost:3000`

## Recommended Demo Mode
Use `USE_MOCK_DATA=true` in `.env.local` for stable demo behavior.
Switch to `false` only when all live credentials are configured.

## Core Routes
- `/planning`: main query entry page
- `/search?q=...`: unified results view
- `/itinerary`: generated day-wise plan
- `/api/search`: orchestrated search endpoint
- `/api/llm/chat`: contextual chat assistant
- `/api/llm/itinerary`: itinerary generation endpoint
- `/api/trip-insights`: weather and trend insights

## Data and Reliability Notes
- Search calls hotel/flight/local sources in parallel.
- Ranking is rule-based and explainable (budget fit, convenience, quality, interest match).
- If one provider fails, Voyager falls back to alternate inventory sources to keep the user flow usable.

## Project Layout
```text
app/
  api/
  planning/
  search/
  itinerary/
components/
  chat/
  columns/
lib/
  ai.ts
  query-parser-ai.ts
  tbo-api.ts
  light-recommender.ts
```

## Security
- Do not commit `.env.local` or real credentials.
- Keep `.env.example` as placeholders only.
