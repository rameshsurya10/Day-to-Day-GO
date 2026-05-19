'use client';

/* =================================================================
   Console.js — the operator console UI.
   Daily data lives in the browser (localStorage) — NO database.
   The only server call is /api/coach, which holds the AI key and
   stores nothing. This component owns all state.
   ================================================================= */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TASKS, LEVELS, summarize, computeStreak, todayStr } from '@/lib/tasks';

const STORE_KEY = 'd2d.v2';

/* Mon-Fri schedule, used only for the "NOW" indicator. [startMinutes, label] */
const SCHEDULE = [
  [320, 'WAKE UP'], [330, 'TRADING CLASS — AM'], [390, 'WORKOUT'],
  [420, 'RECOVERY SLEEP'], [480, 'READY + BREAKFAST'], [570, 'COMMUTE'],
  [600, 'OFFICE — ENERGY GUARD'], [1170, 'RESET / WALK'], [1200, 'DINNER'],
  [1230, 'CODING BLOCK'], [1290, 'TRADING CLASS — PM'], [1350, 'FAMILY TIME'],
  [1380, 'LIGHT REVIEW'], [1410, 'WIND DOWN — SLEEP'],
];

const VERDICTS = {
  BROKEN:   ['SYSTEM BROKEN', 'Level 1 incomplete. Clear the four non-negotiables before sleep — the day is still recoverable.'],
  SURVIVED: ['SYSTEM SECURED', 'Minimum guarantee met. The streak holds. This is a win, even on a bad day.'],
  STANDARD: ['STANDARD DAY', 'Baseline cleared. Consistent, sustainable output — exactly the target.'],
  PEAK:     ['PEAK DAY', 'Full output logged. Bonus tier reached — do not make this the new minimum.'],
};
const STATUS_COLOR = { BROKEN: 'var(--ash)', SURVIVED: 'var(--red-3)', STANDARD: 'var(--red-2)', PEAK: 'var(--red)' };

const COACH_MODES = [
  { id: 'daily',    label: 'DAILY FEEDBACK' },
  { id: 'patterns', label: 'SPOT PATTERNS' },
  { id: 'weekly',   label: 'WEEKLY REVIEW' },
  { id: 'phase2',   label: 'PHASE 2 PLAN' },
];

function currentBlock(now) {
  const dow = now.getDay();
  if (dow === 0 || dow === 6) return 'WEEKEND — PHASE 2 PREP';
  const mins = now.getHours() * 60 + now.getMinutes();
  let label = SCHEDULE[SCHEDULE.length - 1][1];
  for (const [start, name] of SCHEDULE) {
    if (mins >= start) label = name; else break;
  }
  return 'NOW: ' + label;
}

/* Reads saved state from localStorage, or returns a fresh blank state. */
function loadState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { s = null; }
  if (!s || !s.current) {
    s = { current: { date: todayStr(), done: {} }, history: [], coachNotes: [] };
  }
  if (!Array.isArray(s.history)) s.history = [];
  if (!Array.isArray(s.coachNotes)) s.coachNotes = [];
  return s;
}

/* When the calendar date has changed, archive the finished day into
   history (keeping its task detail) and start a fresh current day. */
function rollover(s) {
  const t = todayStr();
  if (s.current.date === t) return s;
  const sum = summarize(s.current.done);
  const history = s.history.filter((h) => h.date !== s.current.date);
  history.push({
    date: s.current.date,
    done: s.current.done,
    status: sum.status,
    score: sum.score,
  });
  history.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { ...s, current: { date: t, done: {} }, history: history.slice(-120) };
}

function streakOf(s) {
  const statusByDate = {};
  s.history.forEach((h) => { statusByDate[h.date] = h.status; });
  statusByDate[s.current.date] = summarize(s.current.done).status;
  return { statusByDate, streak: computeStreak(statusByDate, s.current.date) };
}

export default function Console() {
  const [state, setState] = useState(null);     // null until mounted (avoids hydration mismatch)
  const [now, setNow] = useState(null);
  const [coachBusy, setCoachBusy] = useState(null);
  const [coachError, setCoachError] = useState('');
  const router = useRouter();

  // Load from localStorage once, on mount.
  useEffect(() => {
    setState(rollover(loadState()));
  }, []);

  // Persist on every change.
  useEffect(() => {
    if (state) localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }, [state]);

  // Clock tick + midnight rollover check.
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => {
      setNow(new Date());
      setState((s) => (s ? rollover(s) : s));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  function toggle(id) {
    setState((s) => {
      if (!s) return s;
      const done = { ...s.current.done, [id]: !s.current.done[id] };
      return { ...s, current: { ...s.current, done } };
    });
  }

  async function runCoach(mode) {
    if (!state) return;
    setCoachBusy(mode);
    setCoachError('');
    try {
      const { streak } = streakOf(state);
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          today: { date: state.current.date, done: state.current.done },
          history: state.history,
          streak,
        }),
      });
      if (res.status === 401) { router.replace('/login'); return; }
      const json = await res.json();
      if (json.success) {
        setState((s) => (s ? { ...s, coachNotes: [json.data, ...s.coachNotes].slice(0, 40) } : s));
      } else {
        setCoachError(json.error || 'Coach unavailable.');
      }
    } catch {
      setCoachError('Could not reach the coach.');
    } finally {
      setCoachBusy(null);
    }
  }

  async function logout() {
    try { await fetch('/api/logout', { method: 'POST' }); } catch { /* ignore */ }
    router.replace('/login');
  }

  /* ----- loading screen ----- */
  if (!state) {
    return <div className="boot"><div>LOADING CONSOLE…</div></div>;
  }

  /* ----- derived state ----- */
  const current = state.current;
  const s = summarize(current.done);
  const { statusByDate, streak } = streakOf(state);

  const pastDesc = [...state.history].sort((a, b) => (a.date < b.date ? 1 : -1));
  const breach =
    pastDesc.length >= 2 &&
    pastDesc[0].status === 'BROKEN' &&
    pastDesc[1].status === 'BROKEN';

  const verdict = VERDICTS[s.status];

  /* history grid — last 30 days */
  const cells = [];
  const gd = new Date(current.date + 'T00:00:00');
  gd.setDate(gd.getDate() - 29);
  for (let i = 0; i < 30; i++) {
    const key = todayStr(gd);
    cells.push({ key, status: statusByDate[key], isToday: key === current.date });
    gd.setDate(gd.getDate() + 1);
  }

  const dateLabel = now
    ? now.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
    : '—';
  const timeLabel = now ? now.toLocaleTimeString(undefined, { hour12: false }) : '--:--:--';
  const blockLabel = now ? currentBlock(now) : '—';

  return (
    <div className="wrap">
      <header>
        <div className="brand">
          DAY<b>//</b>TO<b>//</b>DAY
          <span className="tag">OPERATOR CONSOLE / DOUBLE-SHIFT PROTOCOL</span>
        </div>
        <div className="head-right">
          <div className="clock">
            <span>{dateLabel}</span><br />
            <span className="t">{timeLabel}</span>
            <span className="now">{blockLabel}</span>
          </div>
          <button className="logout" onClick={logout}>LOG OUT</button>
        </div>
      </header>

      {breach && (
        <div className="alert">
          RULE BREACH RISK — system broke 2 days running. Run Level 1 today, no exceptions.
        </div>
      )}

      <section className="stats">
        <div className="stat">
          <div className="k">STREAK</div>
          <div className="v">{streak}<small> days</small></div>
        </div>
        <div className="stat score">
          <div className="k">TODAY SCORE</div>
          <div className="v">{s.score}<small> / 100</small></div>
          <div className="bar"><i style={{ width: s.score + '%' }} /></div>
        </div>
        <div className="stat">
          <div className="k">DAY STATUS</div>
          <div className="v status-v" style={{ color: STATUS_COLOR[s.status] }}>{s.status}</div>
        </div>
      </section>

      <div className="verdict"><b>{verdict[0]}.</b> {verdict[1]}</div>

      {LEVELS.map((lvl, i) => {
        const cfg = TASKS[lvl];
        return (
          <section className={`panel ${lvl}${s.levelDone[lvl] ? ' done' : ''}`} key={lvl}>
            <div className="phead">
              <span className="dot" />
              <span className="num">LEVEL 0{i + 1}</span>
              <span className="name">{cfg.name}</span>
              <span className="secured">SECURED</span>
            </div>
            <div className="sub">{cfg.sub}</div>
            {cfg.items.map((t) => (
              <div
                className={`task${current.done[t.id] ? ' on' : ''}`}
                key={t.id}
                onClick={() => toggle(t.id)}
              >
                <span className="box">{current.done[t.id] ? '✓' : ''}</span>
                <span className="label">{t.label}</span>
                <span className="w">+{t.w}</span>
              </div>
            ))}
          </section>
        );
      })}

      <section className="panel coach">
        <div className="phead">
          <span className="dot" />
          <span className="num">BUDDY</span>
          <span className="name">AI COACH</span>
        </div>
        <div className="coach-actions">
          {COACH_MODES.map((m) => (
            <button
              className="coach-btn"
              key={m.id}
              disabled={!!coachBusy}
              onClick={() => runCoach(m.id)}
            >
              {coachBusy === m.id ? 'THINKING…' : m.label}
            </button>
          ))}
        </div>
        <div className="coach-feed">
          {coachError && <div className="coach-err">{coachError}</div>}
          {state.coachNotes.length === 0 && !coachError && (
            <div className="coach-empty">
              No coaching notes yet. Pick a mode above — Buddy reads your logged data.
            </div>
          )}
          {state.coachNotes.map((n, i) => (
            <div className="coach-note" key={i}>
              <div className="coach-note-head">
                {(n.mode || '').toUpperCase()} · {n.date || ''}
              </div>
              <div className="coach-note-body">{n.content}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="hist">
        <h3>LAST 30 DAYS — SYSTEM LOG</h3>
        <div className="grid">
          {cells.map((c) => (
            <div
              className={`cell${c.isToday ? ' today' : ''}`}
              key={c.key}
              data-s={c.status || undefined}
              title={c.key + (c.status ? ' — ' + c.status : ' — no data')}
            />
          ))}
        </div>
        <div className="legend">
          <span><i style={{ background: 'var(--ash)' }} />BROKEN — Level 1 missed</span>
          <span><i style={{ background: 'var(--red-3)' }} />SURVIVED — minimum met</span>
          <span><i style={{ background: 'var(--red-2)' }} />STANDARD — baseline cleared</span>
          <span><i style={{ background: 'var(--red)' }} />PEAK — full output</span>
        </div>
      </section>

      <section className="rules">
        <h3>GOLDEN RULES</h3>
        <ul>
          <li>Never skip 2 days in a row.</li>
          <li>Reduce effort, never remove the habit.</li>
          <li>Bad day = clear Level 1 only. The streak still survives.</li>
          <li>Protect sleep like an asset. No scrolling after 10 PM.</li>
          <li>No &quot;I&apos;ll compensate tomorrow&quot; mindset.</li>
        </ul>
      </section>

      <footer>
        SAVED IN THIS BROWSER &middot; <a href="/day-to-day.ics">DOWNLOAD CALENDAR (.ics)</a>
      </footer>
    </div>
  );
}
