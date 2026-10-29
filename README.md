# ZidMapa

Citizen graffiti reporting for Serbia. Snap a photo of a tag or graffiti, the app pins it on a map, and a cleaning team uses the map to find what to paint over.

*Prijavi grafite i pomozi da grad bude čist.* English and Serbian (Latin).

## How it works

- **Report:** take a photo (or pick one from the gallery). Location comes from the phone's GPS, or from the photo's EXIF for gallery photos, and you can drag the pin to the exact spot. Photos are resized and stripped of all metadata on the phone before upload.
- **No duplicates:** before submitting, the app shows reports already within 25 m and asks "is it one of these?". Confirming one bumps its report count instead of creating a new pin (and re-opens it if it had been cleaned).
- **Map:** clustered pins, red = needs cleaning, green = cleaned. Links like `/en?r=<id>` open a specific report.
- **Admin:** mark cleaned, hide, or delete reports.
- Reporting is anonymous. Spam is limited with Cloudflare Turnstile and a per-IP rate limit (10/hour; IPs are only stored as salted hashes).

## Stack (all free tiers)

| | |
|---|---|
| App | Next.js 16 (App Router), Tailwind, deployed on Vercel |
| Database, storage, auth | Supabase (Postgres + PostGIS) |
| Map | MapLibre GL + OpenFreeMap tiles (OpenStreetMap data) |
| Bot protection | Cloudflare Turnstile |

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (region: Central EU / Frankfurt).
2. **SQL Editor** → paste and run [`supabase/migrations/20261029000000_init.sql`](supabase/migrations/20261029000000_init.sql).
3. **Authentication → URL Configuration**: set *Site URL* to your deployed URL and add `http://localhost:3000/**` and `https://<your-app>.vercel.app/**` to *Redirect URLs*.
4. **Project Settings → API Keys**: copy the project URL, the publishable key and the secret key.

### 2. Local development

```bash
cp .env.example .env.local   # then fill in the Supabase values
npm install
npm run dev
```

The Turnstile values in `.env.example` are Cloudflare's test keys (always pass), fine for local development.

### 3. Make yourself admin

Log in once through the app (`/en/login`, magic link by email), then in the Supabase SQL editor:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com';
```

### 4. Deploy to Vercel

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new).
2. Add the variables from `.env.example` under *Environment Variables*, with real Turnstile keys from the [Cloudflare dashboard](https://dash.cloudflare.com/?to=/:account/turnstile) (add your Vercel domain to the widget).

### 5. Keep the free database awake

Supabase pauses free projects after 7 days without activity. The [`keepalive`](.github/workflows/keepalive.yml) GitHub Action pings it daily. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as repository secrets (*Settings → Secrets and variables → Actions*).

## Roadmap

- **v2:** cleaning-team dashboard: work status, "after" photos, area filters, CSV/GeoJSON export.
- **v3:** automatic classification with Gemini (tag / throw-up / piece / sticker, surface type, size, possibly-legal mural, offensive content), image-similarity dedup.
- **v4:** Cyrillic, notifications when a reported spot is cleaned, offline upload queue.

## License

[MIT](LICENSE)
