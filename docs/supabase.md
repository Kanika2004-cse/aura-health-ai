# Supabase

## Configure

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings → API.
4. Run every SQL migration in `supabase/migrations` in filename order. The personal anomaly model migration registers model version `1.0.0` and links saved predictions to their source measurements.

Never commit service-role keys. The browser client uses the anon key only.

## Data rules

| Table | Kind |
| --- | --- |
| health_measurements | Raw |
| analysis_results | Derived |
| model_predictions | Derived |
| health_insights | Derived |

User-owned tables are locked to `auth.uid() = user_id`.

`model_versions` is readable by authenticated users and not writable from the client.

## Personal anomaly model

Analysis runs a small unsupervised per-user model in the browser. For each measurement it learns a robust center and spread from the user's earlier readings in a 30-day window, then flags statistical outliers for review. It needs at least five prior readings for a metric. Results are saved to `model_predictions` and linked to `model_versions` and the source measurement. It does not make a diagnosis or trigger emergency actions. Run `20261006110000_personal_anomaly_model.sql` before using saved model predictions.

## Account deletion

The Settings page invokes the `delete-account` Edge Function to delete the signed-in Auth user. Deleting the Auth user cascades through the user-owned tables because their `user_id` foreign keys reference `auth.users(id) ON DELETE CASCADE`.

Deploy it after linking the Supabase project:

```sh
supabase functions deploy delete-account
```

The function uses Supabase's server-side `SUPABASE_SERVICE_ROLE_KEY`. Keep that key in the function environment only; never add it to a `VITE_*` variable or browser code. If the project does not provide it automatically, configure it as a Supabase Function secret before deployment. Account deletion from Settings will report an error until the function is deployed.
