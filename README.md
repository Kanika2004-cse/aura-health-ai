# Aura Health AI

Aura Health AI is a personal health risk insights and decision support application. It brings user-entered or connected health measurements together with personal baselines, trends, and context to surface changes for review.

The analysis is informational and non-diagnostic. It is not a medical device and does not predict disease or replace professional medical advice. Users should discuss health concerns with a qualified clinician. Demo values are labeled as sample UI.

## How it works

- Health measurements and context are stored in the user's private Supabase account; the app can also run locally in demo mode.
- Personal analysis evaluates measurements against the user's earlier readings and can flag statistical outliers when enough history is available.
- The dashboard and Insights page explain patterns and changes to support user review and everyday decisions.

This is an evolving product foundation. It does not provide clinical risk scores, diagnoses, treatment recommendations, or emergency monitoring.

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
