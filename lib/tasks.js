/* =================================================================
   tasks.js — shared task config + scoring engine.
   Pure functions, ZERO server dependencies, so this file is safe to
   import in both client components and server-side API routes.
   ================================================================= */

/* CONFIG — each task carries a WEIGHT (w). Calibrated so:
     All 4 Level-1 tasks  ->  60 pts  (the survival floor)
     All 5 Level-2 tasks  -> +30 pts  (baseline = 90)
     All 4 Level-3 tasks  -> +10 pts  (peak     = 100)
   Adjust a weight if a task matters more or less to you.            */
export const TASKS = {
  l1: {
    name: 'NON-NEGOTIABLE',
    sub: 'Even on the worst day, these four still happen.',
    items: [
      { id: 'l1_class_am',    label: '05:30 trading class — attended live', w: 15 },
      { id: 'l1_workout_min', label: 'Workout — 10 minutes minimum',        w: 15 },
      { id: 'l1_focus',       label: '30 min coding OR trading study',      w: 15 },
      { id: 'l1_sleep',       label: 'Slept on time the night before',      w: 15 },
    ],
  },
  l2: {
    name: 'STANDARD',
    sub: 'Your normal daily baseline.',
    items: [
      { id: 'l2_workout_full', label: 'Full workout — 20–30 minutes',        w: 6 },
      { id: 'l2_coding',       label: '45 min coding block (billing / bot)', w: 6 },
      { id: 'l2_class_pm',     label: '21:30 trading class — attended live', w: 6 },
      { id: 'l2_family',       label: 'Family time / calls',                 w: 6 },
      { id: 'l2_screen',       label: 'Instagram under 20 minutes',          w: 6 },
    ],
  },
  l3: {
    name: 'HIGH PERFORMANCE',
    sub: 'Bonus. Logged when energy is high — never expected.',
    items: [
      { id: 'l3_coding_deep',  label: '60–90 min deep coding',       w: 2.5 },
      { id: 'l3_backtest',     label: 'Trading backtesting session', w: 2.5 },
      { id: 'l3_learning',     label: 'Extra learning block',        w: 2.5 },
      { id: 'l3_workout_long', label: 'Longer / harder workout',     w: 2.5 },
    ],
  },
};

export const LEVELS = ['l1', 'l2', 'l3'];

/* The scoring engine — encodes the anti-break philosophy:
   a day is only BROKEN when Level 1 is incomplete. Nothing else can
   save it, and nothing else is needed to survive. */
export function summarize(done = {}) {
  let score = 0;
  const levelDone = {};
  for (const lvl of LEVELS) {
    let all = true;
    for (const t of TASKS[lvl].items) {
      if (done[t.id]) score += t.w;
      else all = false;
    }
    levelDone[lvl] = all;
  }
  let status;
  if (!levelDone.l1)      status = 'BROKEN';   // system did not survive
  else if (!levelDone.l2) status = 'SURVIVED'; // minimum guarantee met
  else if (!levelDone.l3) status = 'STANDARD'; // baseline cleared
  else                    status = 'PEAK';     // full output
  return { score: Math.round(score), status, levelDone };
}

/* Local-time date key, 'YYYY-MM-DD'. */
export function todayStr(d = new Date()) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/* Streak = consecutive days NOT broken, ending today (or yesterday if
   today is not secured yet, so an unfinished morning never reads as 0).
   statusByDate: { 'YYYY-MM-DD': 'BROKEN'|'SURVIVED'|'STANDARD'|'PEAK' } */
export function computeStreak(statusByDate, today = todayStr()) {
  let count = 0;
  const cur = new Date(today + 'T00:00:00');
  const todayStatus = statusByDate[today];
  if (!todayStatus || todayStatus === 'BROKEN') {
    cur.setDate(cur.getDate() - 1);
  }
  while (true) {
    const key = todayStr(cur);
    const st = statusByDate[key];
    if (!st || st === 'BROKEN') break;
    count++;
    cur.setDate(cur.getDate() - 1);
  }
  return count;
}
