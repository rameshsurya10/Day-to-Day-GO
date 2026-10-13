/* =================================================================
   alerts.js — what needs attention right now, across every section.
   Pure: buildAlerts(state, now) -> [{ id, section, level, icon, title,
   body, tab, sub }]. Ids embed the date/bucket, so each alert (and its
   phone notification) fires once and escalates (soon -> today -> overdue).
   ================================================================= */

import { ALERT_ACTIVE_MINUTES, WEEKLY_LOG_DAY, BACKUP_REMIND_DAYS } from '@/lib/constants';
import { todayStr, summarize, weekStart, toMinutes as toMin, daysBetween } from '@/lib/tracker';
import { loanStatus, iouStatus, dueText, dueLevel } from '@/lib/money';
import { weekSummary, defaultBudget, allCategories } from '@/lib/spend';
import { formatRupees, slotTime } from '@/lib/food';

const LEVEL_RANK = { urgent: 0, warn: 1, info: 2 };
const SUNDAY = 0;


/* True while `now` is inside [at, at + ALERT_ACTIVE_MINUTES). */
function activeAt(at, mins) {
  const start = toMin(at);
  return mins >= start && mins < start + ALERT_ACTIVE_MINUTES;
}

const isOn = (prefs, section) => prefs?.[section] !== false;

function moneyAlerts(state, today) {
  const out = [];
  const soon = state.plan.reminders.dueSoonDays;
  for (const loan of state.loans || []) {
    const s = loanStatus(loan, today);
    if (s.finished || s.paidThisMonth) continue;
    const lvl = dueLevel(s.daysUntil, soon);
    if (lvl === 'later' || lvl === 'none') continue;
    out.push({
      id: `money:loan:${loan.id}:${s.month}:${lvl}`,
      section: 'money', level: lvl === 'soon' ? 'warn' : 'urgent', icon: 'landmark',
      title: `${loan.name} EMI ${formatRupees(loan.emi)} — ${dueText(s.daysUntil).toLowerCase()}`,
      body: 'Mark it paid in Money → Loans & EMIs once done.',
      tab: 'money', sub: 'loans',
    });
  }
  for (const iou of state.ious || []) {
    const s = iouStatus(iou, today);
    if (s.settled) continue;
    const lvl = dueLevel(s.daysUntil, soon);
    if (lvl === 'later' || lvl === 'none') continue;
    const who = iou.dir === 'in'
      ? `${iou.person} owes you ${formatRupees(s.remaining)}`
      : `You owe ${iou.person} ${formatRupees(s.remaining)}`;
    out.push({
      id: `money:iou:${iou.id}:${lvl}`,
      section: 'money', level: lvl === 'soon' ? 'warn' : 'urgent', icon: 'users',
      title: `${who} — ${dueText(s.daysUntil).toLowerCase()}`,
      body: iou.dir === 'in' ? 'Time for a friendly reminder.' : 'Pay or agree a new date.',
      tab: 'money', sub: 'owe',
    });
  }
  const budget = state.budget ?? defaultBudget(state.plan);
  const sum = weekSummary(state.expenses || {}, today, budget, allCategories(state.customCats));
  if (sum.overWeek) {
    out.push({
      id: `money:overweek:${sum.monday}`,
      section: 'money', level: 'warn', icon: 'wallet',
      title: `Food budget over by ${formatRupees(Math.abs(sum.remaining))} this week`,
      body: 'Cook at home and lean on dal and eggs until Monday.',
      tab: 'money', sub: 'spend',
    });
  } else if (sum.overToday) {
    out.push({
      id: `money:overtoday:${today}`,
      section: 'money', level: 'warn', icon: 'wallet',
      title: `Over today's safe food limit (${formatRupees(Math.floor(sum.safeDaily))})`,
      body: `Spent ${formatRupees(sum.today.food)} on food today.`,
      tab: 'money', sub: 'spend',
    });
  }
  return out;
}

function routineAlerts(plan, today, mins, sunday) {
  return plan.reminders.routine
    .filter((r) => (r.days === 'all' || !sunday) && activeAt(r.at, mins))
    .map((r) => ({
      id: `routine:${r.id}:${today}`,
      section: 'routine', level: 'info', icon: r.icon,
      title: r.title, body: r.body, tab: 'today',
    }));
}

function mealAlerts(plan, today, mins, dow) {
  const menu = plan.meals.days[dow];
  if (!menu) return [];
  return plan.meals.slots
    .filter((s) => activeAt(s.at, mins) && (menu[s.id] || []).length)
    .map((s) => ({
      id: `meals:${s.id}:${today}`,
      section: 'meals', level: 'info', icon: 'utensils',
      title: `${s.label} time — ${slotTime(s)}`,
      body: menu[s.id].map((it) => `${it.food} ${it.qty}`).join(', '),
      tab: 'meals',
    }));
}

function checklistAlerts(state, today, mins, dow) {
  const out = [];
  const r = state.plan.reminders;
  const day = summarize(state.plan, today, state.days?.[today]?.done);
  if (mins >= toMin(r.checklistAt) && !day.kept) {
    out.push({
      id: `checklist:day:${today}`,
      section: 'checklist', level: 'warn', icon: 'check',
      title: `Checklist ${day.count}/${day.total} — tick what's done`,
      body: 'A few more checks keeps the streak alive.',
      tab: 'today',
    });
  }
  if (mins >= toMin(r.spendAt) && !(state.expenses?.[today] || []).length) {
    out.push({
      id: `checklist:spend:${today}`,
      section: 'checklist', level: 'info', icon: 'wallet',
      title: "Log today's spending",
      body: 'Even ₹0 days are worth confirming — add anything you paid for.',
      tab: 'money', sub: 'spend',
    });
  }
  const week = weekStart(today);
  const log = state.weeks?.[week] || {};
  const logged = Object.values(log).some((v) => v !== '' && v !== undefined && v !== null);
  if (dow === WEEKLY_LOG_DAY && mins >= toMin(r.weeklyLogAt) && !logged) {
    out.push({
      id: `checklist:weekly:${week}`,
      section: 'checklist', level: 'info', icon: 'chart',
      title: 'Fill this week’s log',
      body: 'Weight, waist, gym, study and joints — takes a minute.',
      tab: 'review',
    });
  }
  // Data lives only in this browser — nudge a backup file regularly.
  const hasData = Object.keys(state.days || {}).length > 0 || Object.keys(state.expenses || {}).length > 0;
  const sinceBackup = state.lastBackup ? daysBetween(state.lastBackup, today) : Infinity;
  if (hasData && sinceBackup >= BACKUP_REMIND_DAYS) {
    out.push({
      id: `checklist:backup:${weekStart(today)}`,
      section: 'checklist', level: 'info', icon: 'box',
      title: state.lastBackup ? `Last backup ${sinceBackup} days ago` : 'Back up your data',
      body: 'Your data lives only in this browser. Export a backup file in Settings → Data.',
      tab: 'settings',
    });
  }
  return out;
}

export function buildAlerts(state, now) {
  const today = todayStr(now);
  const mins = now.getHours() * 60 + now.getMinutes();
  const dow = now.getDay();
  const prefs = state.alertPrefs || {};
  const all = [
    ...(isOn(prefs, 'money') ? moneyAlerts(state, today) : []),
    ...(isOn(prefs, 'routine') ? routineAlerts(state.plan, today, mins, dow === SUNDAY) : []),
    ...(isOn(prefs, 'meals') ? mealAlerts(state.plan, today, mins, dow) : []),
    ...(isOn(prefs, 'checklist') ? checklistAlerts(state, today, mins, dow) : []),
  ];
  return all.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
}
