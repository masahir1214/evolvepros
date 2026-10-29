# Evolve Practice Prospecting

React / Express / tRPC / Drizzle app on **Supabase Postgres**, with its own email + password login
and a direct Google Places API (New) integration. It has no dependency on any hosting platform,
so it runs locally, on a VPS, on Railway/Render or in Docker.

## Run locally

1. Requirements: Node 22+, pnpm 10 (`corepack enable`), a Supabase project.
2. `cp .env.example .env` and fill it in (comments in the file explain each value).
3. `pnpm install`
4. Create the tables once: `pnpm db:migrate`
5. `pnpm dev` and open http://localhost:3000
6. First visit: the page asks you to create the admin account. You need the
   `APP_ADMIN_BOOTSTRAP_TOKEN` from your `.env`. After that, registration is closed and only sign-in is shown.
7. Other people can create their own accounts from the sign-in page (turn this off with `ALLOW_SIGNUP=false`).
   Each account sees only its own leads and drafts. Credentials and CRM sync stay administrator-only, and
   regular accounts share the administrator's Maps/OpenAI/verification keys with an hourly limit of 60 actions.
8. **Forgot password:** the sign-in page sends a one-hour, single-use link. Set `SMTP_URL`, `MAIL_FROM` and
   `APP_BASE_URL` to email it. Without SMTP, running `pnpm dev` prints the link in the terminal.
9. Provider keys (OpenAI, ZeroBounce, Twilio, HubSpot, Zoho, SerpApi) are added in the app under
   **Credentials**. They are stored AES-256-GCM encrypted in the database.

## Scripts

- `pnpm dev` development server (honors `PORT`, default 3000)
- `pnpm build` / `pnpm start` production build and server (`dist/index.js` + `dist/public/`)
- `pnpm db:migrate` apply checked-in migrations; `pnpm db:push` generate + apply after you change `drizzle/schema.ts`
- `pnpm check` / `pnpm test` types and tests

## Google Maps

In Google Cloud, enable **Places API (New)** for your project, create an API key, restrict it to that API
(and to your server's IP if it is fixed), and put it in `GOOGLE_MAPS_API_KEY`. Billing must be enabled.
One search = one Text Search request.

## Supabase notes

- All tables have Row Level Security enabled with no policies, so Supabase's public API (anon key)
  cannot read them. The app reads and writes through the server's database connection only.
- Use the **Session pooler** connection string if your network has no IPv6 (the direct connection is
  IPv6-only on the free plan).
- TLS is used automatically for any non-localhost database.

## Deploy

- **Docker:** `docker build -t evolvepros .` then
  `docker run -p 3000:3000 --env-file .env evolvepros`. Run `pnpm db:migrate` once from your machine first.
- **Railway / Render / VPS:** build `pnpm build`, start `pnpm start`, set the env vars. HTTPS is required in
  production (the session cookie is `Secure`); the server trusts one proxy hop for `X-Forwarded-*`.
