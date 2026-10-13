/* =================================================================
   food.js — derived views of the plan's food data. Pure functions:
   safe on client and server.
   ================================================================= */

import { formatTime } from '@/lib/tracker';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayName(dow) {
  return DAY_NAMES[dow];
}

/* Short display name: "Ragi dosa (ragi flour)" -> "Ragi dosa". */
const shortFood = (food) => food.split(' (')[0].split(',')[0];

/* Unique food names carrying `tag` across a day's menu, in meal order. */
export function sourcesFor(plan, dow, tag) {
  const menu = plan.meals.days[dow];
  if (!menu) return [];
  const seen = new Set();
  for (const slot of plan.meals.slots) {
    for (const it of menu[slot.id] || []) if (it.tags.includes(tag)) seen.add(shortFood(it.food));
  }
  return [...seen];
}

/* Weekly and full-program budget, summed from the shopping list. */
export function shoppingTotals(plan) {
  const rows = plan.shopping.items;
  const min = rows.reduce((a, r) => a + r.min, 0);
  const max = rows.reduce((a, r) => a + r.max, 0);
  const weeks = plan.program.weeks;
  return { min, max, programMin: min * weeks, programMax: max * weeks, hasList: rows.length > 0 };
}

export function formatRupees(n) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export const slotTime = (slot) => formatTime(slot.at);

/* One day's menu as plain text — used in the coach prompt and alerts. */
export function menuText(plan, dow) {
  const menu = plan.meals.days[dow];
  if (!menu) return `${dayName(dow)}: ${plan.sunday.food || 'flexible'}`;
  const slots = plan.meals.slots.map((s) =>
    `${s.label} (${slotTime(s)}): ` + ((menu[s.id] || []).map((it) => `${it.food} ${it.qty}`).join(', ') || '—')
  );
  return `${dayName(dow)} — ${slots.join(' | ')}`;
}
