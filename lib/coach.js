/* =================================================================
   coach.js — Buddy, the AI coach (chat).

   buildSystemPrompt() assembles everything the model knows: a generic
   persona plus the user's own plan and logs (all sent from their
   browser). Nothing about the person is hardcoded here.
   ================================================================= */

import { WEEKLY_FIELDS } from '@/lib/constants';
import { keptMin } from '@/lib/plan';
import { checksFor, summarize, parseDate, formatTime } from '@/lib/tracker';
import { menuText, shoppingTotals, formatRupees } from '@/lib/food';
import { weekSummary, allCategories } from '@/lib/spend';
import { loanStatus, iouStatus, moneyTotals, dueText } from '@/lib/money';

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0];

function persona(plan) {
  const total = plan.checks.weekday.length;
  const kept = keptMin(plan, total);
  const name = plan.profile.name || 'friend';
  return `You are a friendly personal coach inside a routine-tracking app.
Address the user as "${name}". You help with their daily routine, food,
exercise, study, sleep, money and motivation, and you answer any
follow-up question they ask.

Your philosophy:
- Consistency beats a perfect score. A day with ${kept} of ${total} checks is kept.
- Shrink a habit on a hard day; never drop it. Never trade sleep away.
- Food: stick to the plan's foods and portions; suggest affordable,
  local swaps that respect their diet notes.
- You are not a doctor. For ongoing, swollen or limiting pain, advise a
  medical assessment. Never prescribe supplement doses or medication.

Style:
- Warm, direct and concrete — use the plan's real foods, times and the
  user's logged numbers.
- Short answers by default (under ~150 words) unless asked for detail.
- Plain text. Simple lists with "-" are fine. No markdown headers or tables.`;
}

function planText(plan) {
  const p = plan.profile;
  const profile = [p.height, p.weight, p.diet, p.region && `lives in ${p.region}`].filter(Boolean).join('; ');
  const timetable = plan.timetable.map((b) => `${formatTime(b.start)} ${b.title}`).join('; ');
  const menus = WEEK_DAYS.map((d) => menuText(plan, d)).join('\n');
  const m = plan.meals;
  const calcium = plan.calcium.items.map((c) => `${c.title}: ${c.amount}`).join('; ');
  const t = shoppingTotals(plan);
  const shopping = plan.shopping.items.map((r) => `${r.item} ${r.qty}`).join(', ');
  const focus = plan.program.weekFocus.map((f, i) => `Week ${i + 1}: ${f}`).join(' ');
  return [
    profile && `PROFILE: ${profile}.`,
    timetable && `MON–SAT TIMETABLE: ${timetable}. Sunday: ${plan.sunday.plan.join(' ') || 'flexible'}`,
    `FOOD CHART:\n${menus}`,
    `PORTIONS: ${[...m.quantityGuide, m.hungerRule, m.restDayRule].filter(Boolean).join(' ')}`,
    calcium && `${plan.calcium.title.toUpperCase()} (${plan.calcium.target}): ${calcium}.`,
    t.hasList && `WEEKLY SHOPPING (~${formatRupees(t.min)}–${formatRupees(t.max)}/week): ${shopping}.`,
    focus && `${plan.program.weeks}-WEEK FOCUS: ${focus}`,
  ].filter(Boolean).join('\n\n');
}

function weekday(key) {
  return parseDate(key).toLocaleDateString('en-US', { weekday: 'short' });
}

function formatDay(plan, key, done = {}) {
  const { count, total, kept } = summarize(plan, key, done);
  const missed = checksFor(plan, key).filter((c) => !done[c.id]).map((c) => c.label);
  const tail = missed.length ? ` | missed: ${missed.join(', ')}` : ' | all done';
  return `${key} (${weekday(key)}) ${count}/${total} ${kept ? 'kept' : 'not kept'}${tail}`;
}

function formatWeek(log) {
  const parts = WEEKLY_FIELDS
    .filter((f) => log.values[f.id] !== undefined && log.values[f.id] !== '')
    .map((f) => `${f.label}: ${log.values[f.id]}${f.unit ? ' ' + f.unit : ''}`);
  return `Week of ${log.week} — ${parts.length ? parts.join('; ') : 'nothing logged'}`;
}

function formatSpend(expenses, today, budget, customCats) {
  const all = allCategories(customCats);
  const s = weekSummary(expenses, today, budget, all);
  const cats = (w) => all.map((c) => `${c.label} ${formatRupees(w.byCat[c.id])}`).join(', ');
  return [
    `The weekly budget ${formatRupees(s.budget)} covers FOOD only (${all.filter((c) => c.food).map((c) => c.label).join(', ')}); ` +
      `other categories are tracked but outside the budget — never compare total spend with the budget.`,
    `This week (${s.monday} to today): food ${formatRupees(s.thisWeek.food)}; all categories ${formatRupees(s.thisWeek.total)} — ${cats(s.thisWeek)}.`,
    `${s.overWeek ? 'OVER food budget by' : 'Food budget left'} ${formatRupees(Math.abs(s.remaining))} with ${s.daysLeft} day(s) left ` +
      `(safe ${formatRupees(Math.floor(s.safeDaily))}/day of food). Today so far: food ${formatRupees(s.today.food)}, all ${formatRupees(s.today.total)}.`,
    `Last week: food ${formatRupees(s.lastWeek.food)}, all ${formatRupees(s.lastWeek.total)} — ${cats(s.lastWeek)}.`,
  ].join('\n');
}

function formatMoney(loans, ious, today) {
  if (!loans.length && !ious.length) return '(no loans or money owed recorded)';
  const t = moneyTotals(loans, ious, today);
  const lines = [
    `EMIs this month ${formatRupees(t.emiThisMonth)} (paid ${formatRupees(t.emiPaidThisMonth)}), ≈${formatRupees(Math.round(t.loanLeft))} left across loans. ` +
      `Others owe me ${formatRupees(t.owedToMe)}; I owe ${formatRupees(t.iOwe)}.`,
  ];
  for (const l of loans) {
    const s = loanStatus(l, today);
    lines.push(`- Loan "${l.name}": EMI ${formatRupees(l.emi)} on day ${l.dueDay}, ${s.paidCount}/${l.totalMonths} paid, ` +
      (s.finished ? 'completed' : s.paidThisMonth ? 'paid this month' : dueText(s.daysUntil).toLowerCase()));
  }
  for (const i of ious) {
    const s = iouStatus(i, today);
    if (s.settled) continue;
    lines.push(`- ${i.dir === 'in' ? `${i.person} owes me` : `I owe ${i.person}`} ${formatRupees(s.remaining)}` +
      (i.due ? ` (${dueText(s.daysUntil).toLowerCase()})` : ' (no due date)') + (i.note ? ` — ${i.note}` : ''));
  }
  return lines.join('\n');
}

/* ctx: { today: {date, done}, days: [{date, done}] newest first,
          weeks: [{week, values}] newest first, streak, programWeek, now,
          expenses: {date: [{cat, amount, note}]}, budget, customCats, loans, ious,
          plan (already normalised) } */
export function buildSystemPrompt(ctx) {
  const { plan, today, days, weeks, streak, programWeek, now, expenses, budget, customCats, loans = [], ious = [] } = ctx;
  const history = days
    .filter((d) => d.date !== today.date)
    .map((d) => formatDay(plan, d.date, d.done))
    .join('\n');
  const weekly = weeks.map(formatWeek).join('\n');
  const focus = plan.program.weekFocus[programWeek - 1];

  const userData = [
    `NOW: ${today.date} (${weekday(today.date)})${now ? ' ' + now : ''}. Program week ${programWeek}${focus ? ` — focus: ${focus}` : ''}.`,
    `STREAK: ${streak} kept day(s).`,
    `TODAY: ${formatDay(plan, today.date, today.done)}`,
    `TODAY'S MENU: ${menuText(plan, parseDate(today.date).getDay())}`,
    `RECENT DAYS (newest first):\n${history || '(none logged)'}`,
    `WEEKLY LOGS (newest first):\n${weekly || '(none yet)'}`,
    `SPENDING:\n${formatSpend(expenses, today.date, budget, customCats)}`,
    `LOANS & MONEY OWED:\n${formatMoney(loans, ious, today.date)}`,
  ].join('\n');

  return `${persona(plan)}\n\n=== THE PLAN ===\n${planText(plan)}\n\n=== USER DATA ===\n${userData}`;
}

/* Ready-made prompts shown as chips in the chat. */
export const QUICK_PROMPTS = [
  { id: 'today',  label: 'Feedback on today',    text: 'Give me short, honest feedback on today so far and the one thing to do before bed.' },
  { id: 'meals',  label: "Explain today's food", text: "Walk me through today's meals — why each one, and what I can swap if something isn't available." },
  { id: 'hungry', label: 'Still hungry',         text: "I'm still hungry after dinner. What should I add from the plan?" },
  { id: 'dues',   label: 'EMIs & dues',          text: 'Go through my EMIs and money owed: what is due soon, what to pay first, and how it affects my budget.' },
  { id: 'week',   label: 'Weekly review',        text: 'Review my last 7 days: what held, what slipped, and my single focus for next week.' },
  { id: 'budget', label: 'Cut my spending',      text: 'Look at my spending this week vs budget and last week. Where should I cut, and which cheaper swaps keep my meals healthy?' },
];
