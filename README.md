# Aura Health AI

Personal health intelligence product. Phase 1 is foundation only: design system, app shell, demo dashboard, and a private Supabase schema.

This is not a medical device. Demo values on the dashboard are labeled as sample UI.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173`.

Optional: paste your Supabase project URL and anon key into `.env.local`. The app runs without them in local demo mode.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm test` — unit tests
- `npm run lint` — oxlint

## Supabase

Apply every SQL migration in `supabase/migrations` in filename order in the SQL editor, or with the Supabase CLI from this folder. The emergency health card requires the latest migration to add its user-controlled health details.

See `docs/supabase.md`.
