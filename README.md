# DAY//TO//DAY — Operator Console

A daily achievement system built around two fixed anchors — **5:30 AM
trading class** and **9:30 PM trading class** — with an AI coach that
reads your real logged data.

It encodes the *anti-break* philosophy: a day is only **BROKEN** when a
Level 1 (non-negotiable) task is missed. Reduce effort on bad days, never
remove the habit. The streak survives as long as Level 1 survives.

---

## No database — here's where your data lives

| Thing | Where it lives |
|-------|----------------|
| Your daily task logs, streak, history | **Your browser** (`localStorage`) — on each device |
| The AI coach key | The server (Vercel) — never sent to the browser |

There is **no database** anywhere. The server function (`/api/coach`) is a
pass-through: your browser sends it today's data, it asks the AI, it
returns Buddy's advice, and it **stores nothing**.

> Each device keeps its own data (your phone and laptop won't share). The
> data lives only in the browser it was entered on.

---

## What it's made of

```
app/
  layout.js            root layout + fonts
  page.js              home — renders the console
  globals.css          the "operator console" theme
  login/page.js        password screen
  api/login            password -> session cookie
  api/logout           clear session
  api/coach            POST -> run the AI coach (stateless, no storage)
components/Console.js  the main UI — data in localStorage
lib/tasks.js           task config + scoring engine
lib/auth.js            session token helpers
lib/coach.js           "Buddy" persona + prompt builder
middleware.js          the password gate
public/day-to-day.ics  the calendar file
legacy/standalone.html the original offline version (no server at all)
```

---

## Deploy to Vercel — only 2 settings

### 1. Put the code on GitHub
Create a GitHub repo and push this folder to it.

### 2. Import to Vercel
Go to [vercel.com/new](https://vercel.com/new) and import the repo.
Vercel auto-detects Next.js — leave all build settings as-is.

### 3. Set two environment variables
Vercel project → **Settings → Environment Variables**:

| Key | Value |
|-----|-------|
| `APP_PASSWORD` | The password you log in with. |
| `AUTH_SECRET` | A long random string — `openssl rand -hex 32`. |

That's it — no database URL, no connection string. The AI Gateway is
provided automatically by Vercel. (`COACH_MODEL` is optional and defaults
to `anthropic/claude-sonnet-4-6`.)

### 4. Deploy
You get a live URL. Open it, log in, start logging your day.
**Phone:** open the URL on your phone → *Add to Home Screen*.

---

## Local development

```bash
cp .env.example .env.local      # fill in the values
npm install
npm run dev                     # http://localhost:3000
```

For the AI coach to work locally, set `AI_GATEWAY_API_KEY` in `.env.local`.

---

## Tuning it to you

- **Scoring** — `lib/tasks.js`, the `TASKS` config. Each task has a weight
  (`w`). Defaults: Level 1 = 60 pts, Level 2 = +30, Level 3 = +10.
- **The AI coach's voice** — `lib/coach.js`, the `COACH_PERSONA` constant.
  This single string defines how blunt, warm, or detailed "Buddy" is.

---

## The rules (don't break these)

- Never skip 2 days in a row.
- Reduce effort, never remove the habit.
- Bad day = clear Level 1 only. The streak still survives.
- Protect sleep like an asset. No scrolling after 10 PM.
- No "I'll compensate tomorrow" mindset.

## Offline version
`legacy/standalone.html` is the original single file — no server, no login,
no AI. Open it in any browser and it works. Keep it as an offline backup.
