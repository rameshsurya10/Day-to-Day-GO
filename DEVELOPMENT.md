# Day to Day — Developer guide

Setup, deployment and code layout. For what the app does and how to use it, see [README.md](README.md).

## Where data lives

| Data | Where |
|------|-------|
| Plan, checklist, logs, expenses, loans, money owed, chat | Browser `localStorage` (key `d2d.v3`) |
| Groq API key, app password, auth secret | Server environment only |

The repo ships only a neutral starter plan (`lib/planTemplate.js`). Personal plans are imported in Settings; `*.private.json` and `day-to-day-backup-*.json` are git-ignored.

## Deploy to Vercel

1. Push to GitHub (check `git status` shows no `.env` or `*.private.json`).
2. [vercel.com/new](https://vercel.com/new) → import the repo (Next.js is auto-detected).
3. **Settings → Environment Variables** — add:

   | Key | Required | Notes |
   |-----|----------|-------|
   | `APP_PASSWORD` | yes | 12+ characters. |
   | `AUTH_SECRET` | yes | ≥ 32 chars — `openssl rand -hex 32`. |
   | `GROQ_API_KEY` | for the coach | console.groq.com/keys |
   | `GROQ_BASE_URL` | no | Defaults to Groq. |
   | `COACH_MODEL` | for the coach | e.g. `openai/gpt-oss-120b` |
   | `SESSION_DAYS`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MINUTES`, `COACH_MAX_REQUESTS` | no | Tuning. |

4. Deploy, open the URL on your phone, log in, import your plan, and
   **Install** the app. Every `git push` redeploys automatically.

If `APP_PASSWORD` or `AUTH_SECRET` is missing, login is refused (the app fails
closed — there are no fallback secrets).

## Security

- HMAC-signed session cookie (`httpOnly`, `secure` in production, `sameSite=lax`).
- Login rate-limited per IP; coach rate-limited per IP.
- Security headers: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, referrer and permissions policies.
- Every plan, backup and API payload is validated and size-limited.
- Rate limits are per server instance; for heavier traffic use a shared store
  (e.g. Upstash Redis from the Vercel Marketplace).

## Local development

```bash
cp .env.example .env.local   # fill in APP_PASSWORD and AUTH_SECRET
npm install
npm run dev                  # http://localhost:3000
```

Restart `npm run dev` after editing env files. Offline caching runs only in
production builds, so dev always shows fresh code.

## Project layout

```
app/
  layout.js  page.js  globals.css  manifest.js
  login/page.js                 password screen
  api/login, api/logout         session cookie (rate-limited)
  api/coach                     streams Buddy's reply (Groq), stateless
components/
  AppShell.js                   header, tabs (URL hash), bottom nav, alerts
  TodayView  MealsView  MoneyView (SpendView, LoansView, OweView)
  BuddyView  ReviewView  HealthView  AlertsPanel  SettingsView
  settings/ListEditor.js        generic list editor
  settings/PlanSections.js      one editor per plan section
  useRoutineStore.js            localStorage state, backup/import
  usePwa.js                     service worker, notifications, install
lib/
  constants.js                  app mechanics (limits, categories) — nothing personal
  planTemplate.js               neutral starter plan
  plan.js                       plan validation (normalizePlan)
  tracker.js  food.js  spend.js  money.js  alerts.js  coach.js
  ai.js  auth.js  rateLimit.js
middleware.js                   password gate (fails closed)
public/sw.js  public/icons/     PWA offline cache + icons
```
