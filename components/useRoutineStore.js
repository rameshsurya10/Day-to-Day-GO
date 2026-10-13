'use client';

/* =================================================================
   useRoutineStore — all app state, persisted in localStorage.
   No database: each browser keeps its own data (the user's plan
   included). Clearing *cached files* never touches it; clearing *site
   data* does, so the app asks for persistent storage and offers a
   backup file (exportBackup / importFile). Days are keyed by date, so
   there is no midnight "rollover" — "today" comes from the clock.
   ================================================================= */

import { useState, useEffect, useCallback } from 'react';
import { todayStr, addDays } from '@/lib/tracker';
import { AUTO_SPEND, STORE_KEY, APP_ID, BACKUP_VERSION } from '@/lib/constants';
import { normalizePlan } from '@/lib/plan';
import { PLAN_TEMPLATE } from '@/lib/planTemplate';

const KEEP_DAYS = 120;          // older day logs are pruned
const KEEP_CHAT = 40;           // chat messages kept
const CLOCK_TICK_MS = 30000;    // "now" refresh rate
const KEEP_ALERT_IDS = 300;     // seen/notified alert ids remembered
const DEFAULT_ALERT_PREFS = { money: true, routine: true, checklist: true, meals: true, notify: false };

const newId = (prefix = '') => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/* Add an expense to a state's expenses map (pure helper). */
function withExpense(expenses, date, entry) {
  return { ...expenses, [date]: [...(expenses[date] || []), entry] };
}

/* Remove an expense by id (pure helper). */
function withoutExpense(expenses, date, id) {
  const left = (expenses[date] || []).filter((e) => e.id !== id);
  const out = { ...expenses };
  if (left.length) out[date] = left; else delete out[date];
  return out;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function freshState(today) {
  return {
    programStart: today, days: {}, weeks: {}, chat: [], expenses: {}, budget: null, customCats: [],
    loans: [], ious: [], alertPrefs: DEFAULT_ALERT_PREFS, alertSeen: [], alertNotified: [],
    installDismissed: false, lastBackup: null, plan: structuredClone(PLAN_TEMPLATE),
  };
}

/* Validate a whole saved state (from localStorage or a backup file).
   Returns null if it isn't one of ours. */
function cleanState(s) {
  if (!s || typeof s !== 'object' || typeof s.programStart !== 'string' || !DATE_RE.test(s.programStart)) return null;
  return {
    programStart: s.programStart,
    plan: normalizePlan(s.plan ?? PLAN_TEMPLATE),
    lastBackup: typeof s.lastBackup === 'string' && DATE_RE.test(s.lastBackup) ? s.lastBackup : null,
    days: s.days && typeof s.days === 'object' ? s.days : {},
    weeks: s.weeks && typeof s.weeks === 'object' ? s.weeks : {},
    expenses: s.expenses && typeof s.expenses === 'object' ? s.expenses : {},
    budget: Number.isFinite(s.budget) && s.budget > 0 ? s.budget : null,
    loans: arr(s.loans),
    ious: arr(s.ious),
    alertPrefs: { ...DEFAULT_ALERT_PREFS, ...obj(s.alertPrefs) },
    alertSeen: arr(s.alertSeen),
    alertNotified: arr(s.alertNotified),
    installDismissed: s.installDismissed === true,
    customCats: Array.isArray(s.customCats)
      ? s.customCats.filter((c) => c && typeof c.id === 'string' && typeof c.label === 'string')
      : [],
    chat: Array.isArray(s.chat)
      ? s.chat.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      : [],
  };
}

function loadState(today) {
  try {
    const s = cleanState(JSON.parse(localStorage.getItem(STORE_KEY)));
    if (s) return s;
  } catch { /* corrupt or unavailable storage — start fresh */ }
  return freshState(today);
}

/* Ask the browser not to evict our storage under pressure. Granted
   automatically for installed apps in most browsers. */
async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

function prune(byDate, today) {
  const cutoff = addDays(today, -KEEP_DAYS);
  return Object.fromEntries(Object.entries(byDate).filter(([k]) => k >= cutoff));
}

export function useRoutineStore() {
  const [state, setState] = useState(null);   // null until mounted (avoids hydration mismatch)
  const [now, setNow] = useState(null);
  const [persisted, setPersisted] = useState(null);   // null = unknown / unsupported

  useEffect(() => {
    const d = new Date();
    setNow(d);
    const s = loadState(todayStr(d));
    setState({ ...s, days: prune(s.days, todayStr(d)), expenses: prune(s.expenses, todayStr(d)) });
    requestPersistence().then(setPersisted);
    const tick = () => setNow(new Date());
    const t = setInterval(tick, CLOCK_TICK_MS);
    // Background tabs throttle timers — refresh the clock when the app reopens.
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    // Another tab saved — adopt its state so we never overwrite its changes.
    const onStorage = (e) => { if (e.key === STORE_KEY) setState(loadState(todayStr(new Date()))); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
  }, [state]);

  const toggleCheck = useCallback((date, id) => {
    setState((s) => {
      const done = { ...(s.days[date]?.done || {}) };
      if (done[id]) delete done[id]; else done[id] = true;
      return { ...s, days: { ...s.days, [date]: { done } } };
    });
  }, []);

  const setWeekField = useCallback((week, id, value) => {
    setState((s) => ({
      ...s,
      weeks: { ...s.weeks, [week]: { ...(s.weeks[week] || {}), [id]: value } },
    }));
  }, []);

  const appendChat = useCallback((messages) => {
    setState((s) => ({ ...s, chat: [...s.chat, ...messages].slice(-KEEP_CHAT) }));
  }, []);

  const clearChat = useCallback(() => {
    setState((s) => ({ ...s, chat: [] }));
  }, []);

  /* entry: { cat, amount, note } — id is assigned here. */
  const addExpense = useCallback((date, entry) => {
    setState((s) => ({ ...s, expenses: withExpense(s.expenses, date, { id: newId(), ...entry }) }));
  }, []);

  const removeExpense = useCallback((date, id) => {
    setState((s) => ({ ...s, expenses: withoutExpense(s.expenses, date, id) }));
  }, []);

  /* cat: { label, food } — returns the new id so the form can select it. */
  const addCategory = useCallback((cat) => {
    const id = 'c_' + Date.now().toString(36);
    setState((s) => ({ ...s, customCats: [...s.customCats, { id, label: cat.label, food: !!cat.food }] }));
    return id;
  }, []);

  /* Entries keep their old id and are counted under "Other". */
  const removeCategory = useCallback((id) => {
    setState((s) => ({ ...s, customCats: s.customCats.filter((c) => c.id !== id) }));
  }, []);

  const setBudget = useCallback((budget) => {
    setState((s) => ({ ...s, budget }));
  }, []);

  /* ---- loans & EMIs ---- */
  const addLoan = useCallback((loan) => {
    setState((s) => ({ ...s, loans: [...s.loans, { id: newId('l_'), paid: {}, ...loan }] }));
  }, []);

  const removeLoan = useCallback((id) => {
    setState((s) => ({ ...s, loans: s.loans.filter((l) => l.id !== id) }));
  }, []);

  /* Toggle this month's EMI. Paying also logs an "EMI & loans" expense
     on `date`; undoing removes that same expense. */
  const toggleLoanPaid = useCallback((loanId, month, date) => {
    setState((s) => {
      const loan = s.loans.find((l) => l.id === loanId);
      if (!loan) return s;
      const paid = { ...(loan.paid || {}) };
      let expenses = s.expenses;
      if (paid[month]) {
        expenses = withoutExpense(expenses, paid[month].date, paid[month].expenseId);
        delete paid[month];
      } else {
        const expenseId = newId();
        expenses = withExpense(expenses, date, { id: expenseId, cat: AUTO_SPEND.emi, amount: loan.emi, note: `${loan.name} EMI` });
        paid[month] = { date, expenseId };
      }
      return { ...s, expenses, loans: s.loans.map((l) => (l.id === loanId ? { ...l, paid } : l)) };
    });
  }, []);

  /* ---- money owed ---- */
  const addIou = useCallback((iou) => {
    setState((s) => ({ ...s, ious: [{ id: newId('i_'), payments: [], created: todayStr(), ...iou }, ...s.ious] }));
  }, []);

  const removeIou = useCallback((id) => {
    setState((s) => ({ ...s, ious: s.ious.filter((i) => i.id !== id) }));
  }, []);

  /* Record a (partial) payment. When I repay someone ('out'), it is
     also logged as a "Repayments" expense. */
  const payIou = useCallback((iouId, amount, date) => {
    setState((s) => {
      const iou = s.ious.find((i) => i.id === iouId);
      if (!iou) return s;
      const payment = { id: newId(), date, amount };
      let expenses = s.expenses;
      if (iou.dir === 'out') {
        payment.expenseId = newId();
        expenses = withExpense(expenses, date, { id: payment.expenseId, cat: AUTO_SPEND.repay, amount, note: `To ${iou.person}` });
      }
      return {
        ...s,
        expenses,
        ious: s.ious.map((i) => (i.id === iouId ? { ...i, payments: [...(i.payments || []), payment] } : i)),
      };
    });
  }, []);

  const undoIouPayment = useCallback((iouId, paymentId) => {
    setState((s) => {
      const iou = s.ious.find((i) => i.id === iouId);
      const p = iou?.payments?.find((x) => x.id === paymentId);
      if (!p) return s;
      const expenses = p.expenseId ? withoutExpense(s.expenses, p.date, p.expenseId) : s.expenses;
      return {
        ...s,
        expenses,
        ious: s.ious.map((i) => (i.id === iouId ? { ...i, payments: i.payments.filter((x) => x.id !== paymentId) } : i)),
      };
    });
  }, []);

  /* ---- alerts ---- */
  const setAlertPrefs = useCallback((patch) => {
    setState((s) => ({ ...s, alertPrefs: { ...s.alertPrefs, ...patch } }));
  }, []);

  const markAlerts = useCallback((key, ids) => {
    if (!ids.length) return;
    setState((s) => {
      const merged = [...new Set([...s[key], ...ids])].slice(-KEEP_ALERT_IDS);
      return merged.length === s[key].length ? s : { ...s, [key]: merged };
    });
  }, []);

  const markAlertsSeen = useCallback((ids) => markAlerts('alertSeen', ids), [markAlerts]);
  const markAlertsNotified = useCallback((ids) => markAlerts('alertNotified', ids), [markAlerts]);

  const dismissInstall = useCallback(() => {
    setState((s) => ({ ...s, installDismissed: true }));
  }, []);

  /* ---- plan (Settings) ---- */
  /* fn receives a deep copy of the plan and returns the edited plan. */
  const updatePlan = useCallback((fn) => {
    setState((s) => {
      const next = normalizePlan(fn(structuredClone(s.plan)));
      next.isTemplate = false;
      return { ...s, plan: next };
    });
  }, []);

  const resetPlan = useCallback(() => {
    setState((s) => ({ ...s, plan: structuredClone(PLAN_TEMPLATE) }));
  }, []);

  /* ---- backup ---- */
  /* Records the backup date (drives the backup reminder). The file
     itself is built by backupFile() from the current state. */
  const markBackedUp = useCallback(() => {
    setState((s) => ({ ...s, lastBackup: todayStr() }));
  }, []);

  /* Accepts a backup file or a plan-only file. Returns a short result. */
  const importFile = useCallback((text) => {
    let parsed;
    try { parsed = JSON.parse(text); } catch { return { ok: false, error: 'That file is not valid JSON.' }; }
    if (!parsed || parsed.app !== APP_ID) return { ok: false, error: 'This is not a Day to Day file.' };
    if (parsed.kind === 'plan') {
      const plan = normalizePlan(parsed.plan);
      plan.isTemplate = false;
      setState((s) => ({ ...s, plan }));
      return { ok: true, message: 'Plan imported.' };
    }
    if (parsed.kind === 'backup') {
      const clean = cleanState(parsed.data);
      if (!clean) return { ok: false, error: 'The backup file is damaged.' };
      setState({ ...clean, alertSeen: [], alertNotified: [] });
      return { ok: true, message: 'Backup restored.' };
    }
    return { ok: false, error: 'Unknown file type.' };
  }, []);

  const clearAll = useCallback(() => {
    setState(freshState(todayStr()));
  }, []);

  const protectStorage = useCallback(async () => {
    setPersisted(await requestPersistence());
  }, []);

  const restartProgram = useCallback((date) => {
    setState((s) => ({ ...s, programStart: date }));
  }, []);

  return {
    state, now, persisted,
    updatePlan, resetPlan, markBackedUp, importFile, clearAll, protectStorage, toggleCheck, setWeekField, appendChat, clearChat, restartProgram,
    addExpense, removeExpense, setBudget, addCategory, removeCategory,
    addLoan, removeLoan, toggleLoanPaid, addIou, removeIou, payIou, undoIouPayment,
    setAlertPrefs,
    markAlertsSeen, markAlertsNotified, dismissInstall,
  };
}

/* Files for download. Pure: built from the state passed in. */
export function backupFile(state) {
  const today = todayStr();
  const { alertSeen, alertNotified, ...data } = state;   // transient ids, not worth keeping
  return {
    filename: `day-to-day-backup-${today}.json`,
    json: JSON.stringify({ app: APP_ID, kind: 'backup', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data }, null, 2),
  };
}

export function planFile(plan) {
  return {
    filename: 'my-plan.private.json',
    json: JSON.stringify({ app: APP_ID, kind: 'plan', version: BACKUP_VERSION, plan }, null, 2),
  };
}
