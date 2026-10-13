/* =================================================================
   spend.js — daily expenses → weekly budget maths.
   Pure functions: used by the Spend tab, Today card, Review table
   and (server-side) the coach prompt, so every number agrees.
   expenses: { 'YYYY-MM-DD': [{ id, cat, amount, note }] }
   ================================================================= */

import { SPEND_CATEGORIES, FALLBACK_CATEGORY, CUSTOM_CATEGORY_ICON } from '@/lib/constants';
import { addDays, weekStart, daysBetween } from '@/lib/tracker';
import { shoppingTotals } from '@/lib/food';

/* Built-in categories plus the user's own (custom: [{id, label, food}]). */
export function allCategories(custom = []) {
  return [...SPEND_CATEGORIES, ...custom.map((c) => ({ ...c, icon: CUSTOM_CATEGORY_ICON, custom: true }))];
}

function foodIds(cats) {
  return new Set(cats.filter((c) => c.food).map((c) => c.id));
}

/* Default weekly food budget: top of the plan's shopping estimate, or
   the plan's default when no shopping list is set. */
export function defaultBudget(plan) {
  const t = shoppingTotals(plan);
  return t.hasList ? t.max : plan.program.defaultBudget;
}

const round2 = (n) => Math.round(n * 100) / 100;

function sumDay(entries = [], food = null) {
  return entries.reduce((a, e) => (!food || food.has(e.cat) ? a + e.amount : a), 0);
}

export function dayTotals(expenses, date, cats = SPEND_CATEGORIES) {
  const list = expenses[date] || [];
  return { total: round2(sumDay(list)), food: round2(sumDay(list, foodIds(cats))) };
}

/* Totals for the Mon–Sun week starting at `monday`, up to `until`. */
function weekTotals(expenses, monday, until, cats) {
  const byCat = Object.fromEntries(cats.map((c) => [c.id, 0]));
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    if (until && d > until) break;
    for (const e of expenses[d] || []) byCat[e.cat in byCat ? e.cat : FALLBACK_CATEGORY] += e.amount;
  }
  const total = Object.values(byCat).reduce((a, b) => a + b, 0);
  const food = cats.filter((c) => c.food).reduce((a, c) => a + byCat[c.id], 0);
  for (const k of Object.keys(byCat)) byCat[k] = round2(byCat[k]);
  return { total: round2(total), food: round2(food), byCat };
}

/* Everything the UI needs about this week's spending vs budget.
   safeDaily = what's left of the food budget, spread over the days
   remaining (today included), measured before today's spending. */
export function weekSummary(expenses, today, budget, cats = SPEND_CATEGORIES) {
  const monday = weekStart(today);
  const thisWeek = weekTotals(expenses, monday, today, cats);
  const lastWeek = weekTotals(expenses, addDays(monday, -7), null, cats);
  const todayTotals = dayTotals(expenses, today, cats);
  const daysLeft = 7 - daysBetween(monday, today);              // includes today
  const beforeToday = round2(thisWeek.food - todayTotals.food);
  const safeDaily = Math.max(0, round2((budget - beforeToday) / daysLeft));
  const remaining = round2(budget - thisWeek.food);
  return {
    monday,
    sunday: addDays(monday, 6),
    budget,
    cats,
    thisWeek,
    lastWeek,
    today: todayTotals,
    daysLeft,
    remaining,
    safeDaily,
    overToday: todayTotals.food > safeDaily,
    overWeek: remaining < 0,
    usedPct: budget > 0 ? Math.min(100, Math.round((thisWeek.food / budget) * 100)) : 0,
  };
}

/* Food spend for the week starting `monday` — used by the trend table. */
export function weekFoodSpend(expenses, monday, cats = SPEND_CATEGORIES) {
  return weekTotals(expenses, monday, null, cats).food;
}
