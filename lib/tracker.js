/* =================================================================
   tracker.js — dates, daily scoring, streak and "what's now".
   Pure functions with ZERO server or browser dependencies, so this
   file is safe to import in client components and API routes alike.
   ================================================================= */

import { keptMin } from '@/lib/plan';

const DAY_MS = 86400000;
const SUNDAY = 0;

/* Local-time date key, 'YYYY-MM-DD'. */
export function todayStr(d = new Date()) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

export function parseDate(key) {
  return new Date(key + 'T00:00:00');
}

export function addDays(key, n) {
  const d = parseDate(key);
  d.setDate(d.getDate() + n);
  return todayStr(d);
}

export function isSunday(key) {
  return parseDate(key).getDay() === SUNDAY;
}

/* Whole days from a to b (b - a), DST-safe via rounding. */
export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / DAY_MS);
}

/* Monday of the week containing `key` — used to key weekly reviews. */
export function weekStart(key) {
  const dow = parseDate(key).getDay();
  return addDays(key, dow === SUNDAY ? -6 : 1 - dow);
}

export function checksFor(plan, key) {
  return isSunday(key) ? plan.checks.sunday : plan.checks.weekday;
}

/* Score one day. A day is "kept" when at least the plan's kept % of
   its checks are done — consistency, not a perfect score. */
export function summarize(plan, key, done = {}) {
  const checks = checksFor(plan, key);
  const count = checks.filter((c) => done[c.id]).length;
  const total = checks.length;
  return { count, total, kept: total > 0 && count >= keptMin(plan, total) };
}

/* Streak = consecutive kept days ending today, or ending yesterday if
   today isn't kept yet (an unfinished morning never reads as 0). */
export function computeStreak(plan, days, today) {
  const keptOn = (key) => summarize(plan, key, days[key]?.done).kept;
  let cur = keptOn(today) ? today : addDays(today, -1);
  let count = 0;
  while (days[cur] && keptOn(cur)) {
    count++;
    cur = addDays(cur, -1);
  }
  return count;
}

/* Where today sits inside the 4-week program. Cycles are aligned to
   Mon–Sun weeks: day 1 is the Monday of the week the program started. */
export function programPosition(plan, programStart, today) {
  const total = plan.program.weeks * 7;
  const start = daysBetween(programStart, today) < 0 ? today : programStart;  // clock moved back
  const anchor = weekStart(start);
  const offset = daysBetween(anchor, today);
  const dayIndex = offset % total;
  const cycleStart = addDays(anchor, offset - dayIndex);
  return {
    cycle: Math.floor(offset / total) + 1,
    week: Math.floor(dayIndex / 7) + 1,
    day: dayIndex + 1,
    total,
    cycleStart,
    cycleEnd: addDays(cycleStart, total - 1),
    startedOn: start,
  };
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/* 'HH:MM' -> '5:30 AM'. */
export function formatTime(hhmm) {
  const mins = toMinutes(hhmm);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

/* Index of the weekday block happening at `now`, plus minutes left.
   Returns null on Sundays (no timetable) once Saturday night's sleep ends. Handles the block that
   wraps past midnight. */
export function currentBlock(plan, now) {
  const blocks = plan.timetable;
  const mins = now.getHours() * 60 + now.getMinutes();
  if (now.getDay() === SUNDAY) {
    // Saturday night's sleep block runs into Sunday morning.
    const i = blocks.findIndex((b) => toMinutes(b.end) <= toMinutes(b.start));
    const end = i >= 0 ? toMinutes(blocks[i].end) : 0;
    return mins < end ? { index: i, minutesLeft: end - mins } : null;
  }
  for (let i = 0; i < blocks.length; i++) {
    const start = toMinutes(blocks[i].start);
    const end = toMinutes(blocks[i].end);
    const wraps = end <= start;
    const inside = wraps ? mins >= start || mins < end : mins >= start && mins < end;
    if (inside) {
      const left = wraps && mins >= start ? 1440 - mins + end : end - mins;
      return { index: i, minutesLeft: left };
    }
  }
  return null;
}
