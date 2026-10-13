/* =================================================================
   money.js — loans/EMIs and money owed (IOUs). Pure functions.

   loan: { id, name, emi, dueDay, totalMonths, paidBefore,
           paid: { 'YYYY-MM': { date, expenseId } }, note }
   iou:  { id, dir: 'in' | 'out', person, amount, due: 'YYYY-MM-DD'|null,
           note, created, payments: [{ id, date, amount, expenseId }] }
     dir 'in'  = they owe me, 'out' = I owe them.
   ================================================================= */

import { daysBetween, todayStr } from '@/lib/tracker';

const round2 = (n) => Math.round(n * 100) / 100;

/* 'YYYY-MM-DD' -> 'YYYY-MM'. */
export function monthKey(date) {
  return date.slice(0, 7);
}

/* The EMI due date in a given month; day 31 becomes the month's last day. */
export function dueDateIn(month, dueDay) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return todayStr(new Date(y, m - 1, Math.min(dueDay, last)));
}

export function loanStatus(loan, today) {
  const month = monthKey(today);
  const paidCount = (loan.paidBefore || 0) + Object.keys(loan.paid || {}).length;
  const remainingMonths = Math.max(0, loan.totalMonths - paidCount);
  const due = dueDateIn(month, loan.dueDay);
  const paidThisMonth = !!loan.paid?.[month];
  return {
    month,
    due,
    paidThisMonth,
    paidCount,
    remainingMonths,
    finished: remainingMonths === 0,
    remainingAmount: round2(remainingMonths * loan.emi),
    daysUntil: daysBetween(today, due),
    pct: loan.totalMonths ? Math.min(100, Math.round((paidCount / loan.totalMonths) * 100)) : 0,
  };
}

export function iouStatus(iou, today) {
  const paid = round2((iou.payments || []).reduce((a, p) => a + p.amount, 0));
  const remaining = Math.max(0, round2(iou.amount - paid));
  return {
    paid,
    remaining,
    settled: remaining === 0,
    daysUntil: iou.due ? daysBetween(today, iou.due) : null,
  };
}

/* Headline numbers for the Money tab and the coach. */
export function moneyTotals(loans, ious, today) {
  let emiThisMonth = 0;
  let emiPaidThisMonth = 0;
  let loanLeft = 0;
  for (const l of loans) {
    const s = loanStatus(l, today);
    if (s.finished && !s.paidThisMonth) continue;
    emiThisMonth += l.emi;
    if (s.paidThisMonth) emiPaidThisMonth += l.emi;
    loanLeft += s.remainingAmount;
  }
  let owedToMe = 0;
  let iOwe = 0;
  for (const i of ious) {
    const r = iouStatus(i, today).remaining;
    if (i.dir === 'in') owedToMe += r; else iOwe += r;
  }
  return {
    emiThisMonth: round2(emiThisMonth),
    emiPaidThisMonth: round2(emiPaidThisMonth),
    loanLeft: round2(loanLeft),
    owedToMe: round2(owedToMe),
    iOwe: round2(iOwe),
    net: round2(owedToMe - iOwe),
  };
}

/* Short human text for a due date relative to today. */
export function dueText(daysUntil) {
  if (daysUntil === null || daysUntil === undefined) return 'No due date';
  if (daysUntil === 0) return 'Due today';
  if (daysUntil === 1) return 'Due tomorrow';
  if (daysUntil > 1) return `Due in ${daysUntil} days`;
  return `Overdue ${-daysUntil} day${daysUntil === -1 ? '' : 's'}`;
}

export function dueLevel(daysUntil, soonDays) {
  if (daysUntil === null || daysUntil === undefined) return 'none';
  if (daysUntil < 0) return 'overdue';
  if (daysUntil === 0) return 'today';
  return daysUntil <= soonDays ? 'soon' : 'later';
}
