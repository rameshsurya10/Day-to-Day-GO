/* =================================================================
   plan.js — validates a user's plan. Every plan (from localStorage,
   an imported file, or sent to the server for the coach) passes
   through normalizePlan(), so bad or tampered data can never break
   the app: unknown fields are dropped, strings are trimmed to limits,
   times must be HH:MM, and a missing section falls back to the
   starter template.
   ================================================================= */

import { PLAN_LIMITS, PLAN_VERSION, MEAL_SLOT_IDS, MEAL_DAYS, ICON_CHOICES, FOOD_TAGS } from '@/lib/constants';
import { PLAN_TEMPLATE } from '@/lib/planTemplate';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_RE = /^[a-z0-9_-]{1,24}$/i;
const TAGS = Object.keys(FOOD_TAGS);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, max = PLAN_LIMITS.maxText, def = '') => (typeof v === 'string' ? v.trim().slice(0, max) : def);
const body = (v, def = '') => str(v, PLAN_LIMITS.maxBody, def);
const time = (v, def) => (typeof v === 'string' && TIME_RE.test(v) ? v : def);
const icon = (v, def = 'box') => (ICON_CHOICES.includes(v) ? v : def);
const num = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
};
const id = (v, i) => (typeof v === 'string' && ID_RE.test(v) ? v : `item${i}`);

/* Clean an array with `fn`, dropping invalid rows, capped at `max`. */
function list(v, fn, max = PLAN_LIMITS.maxList) {
  return (Array.isArray(v) ? v : []).slice(0, max).map(fn).filter(Boolean);
}
const lines = (v) => list(v, (s) => body(s) || null);

/* Unique ids within a list (duplicates get a suffix). */
function uniqueIds(rows) {
  const seen = new Set();
  return rows.map((r) => {
    let rid = r.id;
    for (let n = 2; seen.has(rid); n++) rid = `${r.id}${n}`;
    seen.add(rid);
    return rid === r.id ? r : { ...r, id: rid };
  });
}

const cleanCheck = (c, i) => (isObj(c) && str(c.label)
  ? { id: id(c.id, i), icon: icon(c.icon), label: str(c.label, 24), hint: str(c.hint) }
  : null);

const cleanFood = (f) => (isObj(f) && str(f.food)
  ? { food: str(f.food), qty: str(f.qty, 30), tags: (Array.isArray(f.tags) ? f.tags : []).filter((t) => TAGS.includes(t)) }
  : null);

function cleanMeals(raw, tpl) {
  const m = isObj(raw) ? raw : {};
  const slotsIn = Array.isArray(m.slots) ? m.slots : [];
  const slots = MEAL_SLOT_IDS.map((sid, i) => {
    const s = slotsIn.find((x) => isObj(x) && x.id === sid) || {};
    const t = tpl.slots[i];
    return { id: sid, label: str(s.label, 24) || t.label, at: time(s.at, t.at) };
  });
  const daysIn = isObj(m.days) ? m.days : {};
  const days = {};
  for (const d of MEAL_DAYS) {
    const src = isObj(daysIn[d]) ? daysIn[d] : {};
    days[d] = Object.fromEntries(MEAL_SLOT_IDS.map((sid) => [sid, list(src[sid], cleanFood, PLAN_LIMITS.maxMealItems)]));
  }
  return {
    slots,
    days,
    quantityGuide: lines(m.quantityGuide),
    hungerRule: body(m.hungerRule),
    restDayRule: body(m.restDayRule),
  };
}

export function normalizePlan(raw) {
  const tpl = PLAN_TEMPLATE;
  if (!isObj(raw)) return structuredClone(tpl);
  const p = raw;
  const section = (k) => (isObj(p[k]) ? p[k] : null);

  const prog = section('program') || tpl.program;
  const prof = section('profile') || {};
  const sun = section('sunday') || tpl.sunday;
  const chk = section('checks') || tpl.checks;
  const cal = section('calcium') || tpl.calcium;
  const shop = section('shopping') || tpl.shopping;
  const hl = section('health') || tpl.health;
  const rem = section('reminders') || tpl.reminders;

  const weekday = uniqueIds(list(chk.weekday, cleanCheck));
  const sunday = uniqueIds(list(chk.sunday, cleanCheck));

  return {
    version: PLAN_VERSION,
    isTemplate: p.isTemplate === true,
    profile: {
      name: str(prof.name, 30), height: str(prof.height, 20), weight: str(prof.weight, 20),
      diet: body(prof.diet), region: str(prof.region, 40),
    },
    program: {
      weeks: num(prog.weeks, 1, PLAN_LIMITS.maxWeeks, tpl.program.weeks),
      keptPct: num(prog.keptPct, 1, 100, tpl.program.keptPct),
      defaultBudget: num(prog.defaultBudget, 0, PLAN_LIMITS.maxBudget, tpl.program.defaultBudget),
      weekFocus: lines(prog.weekFocus),
    },
    timetable: list(p.timetable, (b) => (isObj(b) && str(b.title) && TIME_RE.test(b.start) && TIME_RE.test(b.end)
      ? { start: b.start, end: b.end, icon: icon(b.icon), title: str(b.title), note: body(b.note) }
      : null)).sort((a, b) => (a.start < b.start ? -1 : 1)),
    sunday: { plan: lines(sun.plan), food: body(sun.food) },
    checks: {
      weekday: weekday.length ? weekday : structuredClone(tpl.checks.weekday),
      sunday: sunday.length ? sunday : structuredClone(tpl.checks.sunday),
    },
    meals: cleanMeals(p.meals, tpl.meals),
    calcium: {
      title: str(cal.title, 40) || 'Calcium',
      target: body(cal.target),
      items: list(cal.items, (c) => (isObj(c) && str(c.title) ? { title: str(c.title), amount: str(c.amount, 40), body: body(c.body) } : null)),
      note: body(cal.note),
    },
    shopping: {
      note: body(shop.note),
      items: list(shop.items, (r) => {
        if (!isObj(r) || !str(r.item)) return null;
        const min = num(r.min, 0, PLAN_LIMITS.maxBudget, 0);
        return { item: str(r.item), qty: str(r.qty, 30), min, max: Math.max(min, num(r.max, 0, PLAN_LIMITS.maxBudget, min)) };
      }),
      tips: lines(shop.tips),
    },
    health: {
      priorities: list(hl.priorities, (x) => (isObj(x) && str(x.title) ? { title: str(x.title), body: body(x.body) } : null)),
      cards: list(hl.cards, (x) => (isObj(x) && str(x.title) ? { icon: icon(x.icon, 'heart'), title: str(x.title), body: body(x.body) } : null)),
      warning: body(hl.warning),
    },
    reminders: {
      routine: uniqueIds(list(rem.routine, (r, i) => (isObj(r) && str(r.title) && TIME_RE.test(r.at)
        ? { id: id(r.id, i), at: r.at, days: r.days === 'all' ? 'all' : 'weekdays', icon: icon(r.icon, 'clock'), title: str(r.title), body: body(r.body) }
        : null))),
      checklistAt: time(rem.checklistAt, tpl.reminders.checklistAt),
      spendAt: time(rem.spendAt, tpl.reminders.spendAt),
      weeklyLogAt: time(rem.weeklyLogAt, tpl.reminders.weeklyLogAt),
      dueSoonDays: num(rem.dueSoonDays, 0, 30, tpl.reminders.dueSoonDays),
    },
  };
}

/* Checks needed for a day to count as kept. Half a percent of slack so
   "67%" of 6 checks means 4 (66.7%), not 5. */
export function keptMin(plan, total) {
  return total > 0 ? Math.max(1, Math.ceil((total * (plan.program.keptPct - 0.5)) / 100)) : 0;
}
export const displayName = (plan) => plan.profile.name || '';
