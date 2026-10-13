# Day to Day

A mobile-first personal routine app — daily checklist, timetable, meals,
spending, loans & EMIs, money owed, reminders and an AI coach — in a light
glassmorphism UI you can install on your phone (PWA).

**Nothing personal lives in the code.** Your plan (timetable, meals, prices,
reminders, profile) is data you edit in **Settings** and it is stored in your
browser. The repo ships only a neutral starter plan.

## What's inside

| Tab | What it does |
|-----|--------------|
| **Today** | Progress ring, streak, the block you're in *now*, today's spend vs safe limit, upcoming EMIs/dues, the checklist and the timeline. |
| **Meals** | Each day's menu item by item, protein/calcium sources, portions, nutrition plan, weekly shopping list & budget, health notes. |
| **Money** | **Spend** (expenses by category, custom categories, weekly food budget, safe daily limit, this week vs last) · **Loans & EMIs** (due dates, progress, *Mark paid* logs it in Spend) · **Owe** (who owes you / whom you owe, partial payments). |
| **Buddy** | AI chat (Groq). It sees your plan and logs, and answers any question. |
| **Review** | Week focus, Mon–Sun cycle calendar with real dates, weekly log, 4-week trend. |
| **Settings** (gear icon) | Edit every part of the plan; data & backup. |

**Alerts** (bell): EMIs and money owed (before, on and after the due date),
budget limits, your timed reminders, meal times, evening checklist/spend nudges,
weekly log and backup reminders. Phone notifications can be switched on.

## Where your data lives — and how to keep it

| Data | Where |
|------|-------|
| Plan, checklist, logs, expenses, loans, money owed, chat | This browser's `localStorage` (key `d2d.v3`) |
| Groq API key, app password | Server environment only |

- Clearing the browser **cache** is safe.
- Clearing **cookies & site data** deletes your data. The app asks the browser
  for *persistent storage*, and **Settings → Data & backup** lets you download a
  backup file and import it on any device. A reminder appears if you haven't
  backed up for 7 days.
- On iPhone, install the app to the home screen so Safari doesn't clear it
  after 7 days without use.

## First run with your own plan

1. Open the app → **Settings → Data & backup → Import backup or plan file**.
2. Choose your plan file (e.g. `my-plan.private.json`). Files matching
   `*.private.json` and `day-to-day-backup-*.json` are git-ignored.

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
