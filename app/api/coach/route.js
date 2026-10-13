/* POST /api/coach — chat with Buddy. STATELESS, streams plain text.

   The browser sends the conversation plus its own logged data; this
   route builds the system prompt and streams the model's reply. It
   stores NOTHING. Its only job is to keep the API key on the server.

   body: { messages: [{role: 'user'|'assistant', content}],
           context: { today: {date, done}, days: [{date, done}],
                      weeks: [{week, values}], streak, programWeek, now } } */

import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { coachModel, coachConfigError } from '@/lib/ai';
import { buildSystemPrompt } from '@/lib/coach';
import { WEEKLY_FIELDS, SPEND_CATEGORIES, SPEND_LIMITS, FALLBACK_CATEGORY, MONEY_LIMITS } from '@/lib/constants';
import { normalizePlan } from '@/lib/plan';
import { clientIp, hit } from '@/lib/rateLimit';
import { addDays } from '@/lib/tracker';
import { defaultBudget } from '@/lib/spend';

export const maxDuration = 60;

const MAX_BODY_BYTES = 160 * 1024;
const COACH_MAX_REQUESTS = Number(process.env.COACH_MAX_REQUESTS) || 30;   // per IP per window
const COACH_WINDOW_MS = 10 * 60 * 1000;
const MAX_MESSAGES = 20;          // conversation turns sent to the model
const MAX_MESSAGE_CHARS = 2000;
const MAX_DAYS = 28;
const MAX_WEEKS = 4;
const MODEL_TIMEOUT_MS = 45000;
const MAX_OUTPUT_TOKENS = 4000;   // reasoning models count their thinking toward this
const MODEL_RETRIES = 2;          // retries on temporary provider errors (429 / 5xx)
/* Marks an error inside the text stream. \u0000 never appears in normal
   model text; the client splits on it to show a clear message. */
const ERROR_MARK = '\u0000';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ROLES = new Set(['user', 'assistant']);
const SPEND_DAYS = 14;            // this week + last week is enough for the coach
const BUILTIN_CAT_IDS = SPEND_CATEGORIES.map((c) => c.id);
const CUSTOM_ID_RE = /^c_[a-z0-9]{1,16}$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const bad = (error, status = 400) => NextResponse.json({ success: false, error }, { status });

/* Keep only `true` flags with short keys. */
function cleanDone(done) {
  if (!isObj(done)) return {};
  const out = {};
  for (const [k, v] of Object.entries(done)) if (k.length <= 32 && v === true) out[k] = true;
  return out;
}

function cleanDay(d) {
  return isObj(d) && DATE_RE.test(d.date) ? { date: d.date, done: cleanDone(d.done) } : null;
}

/* Keep only known weekly fields, clamped to their configured limits. */
function cleanWeek(w) {
  if (!isObj(w) || !DATE_RE.test(w.week) || !isObj(w.values)) return null;
  const values = {};
  for (const f of WEEKLY_FIELDS) {
    const v = w.values[f.id];
    if (f.type === 'number') {
      const n = Number(v);
      if (v !== '' && v !== undefined && Number.isFinite(n) && n >= 0 && n <= f.max) values[f.id] = n;
    } else if (typeof v === 'string' && v.trim()) {
      values[f.id] = v.trim().slice(0, f.maxLength);
    }
  }
  return { week: w.week, values };
}

/* User-made categories: safe ids, short labels, bounded count. */
function cleanCustomCats(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => isObj(c) && CUSTOM_ID_RE.test(c.id) && typeof c.label === 'string' && c.label.trim())
    .slice(0, SPEND_LIMITS.maxCustomCats)
    .map((c) => ({ id: c.id, label: c.label.trim().slice(0, SPEND_LIMITS.maxCatLabel), food: c.food === true }));
}

/* Recent expenses only, bounded amounts and notes. Entries from a
   deleted category count as "Other" — same rule as the app. */
function cleanExpenses(raw, today, catIds) {
  if (!isObj(raw)) return {};
  const from = addDays(today, -SPEND_DAYS);
  const out = {};
  for (const [date, list] of Object.entries(raw)) {
    if (!DATE_RE.test(date) || date < from || date > today || !Array.isArray(list)) continue;
    const clean = list
      .filter((e) => isObj(e) && typeof e.cat === 'string' && Number.isFinite(e.amount) && e.amount > 0 && e.amount <= SPEND_LIMITS.maxAmount)
      .slice(0, SPEND_LIMITS.maxEntriesPerDay)
      .map((e) => ({ cat: catIds.has(e.cat) ? e.cat : FALLBACK_CATEGORY, amount: e.amount, note: typeof e.note === 'string' ? e.note.slice(0, SPEND_LIMITS.maxNote) : '' }));
    if (clean.length) out[date] = clean;
  }
  return out;
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const money = (v) => (Number.isFinite(v) && v > 0 && v <= MONEY_LIMITS.maxAmount ? v : null);
const MONTH_RE = /^\d{4}-\d{2}$/;

function cleanLoans(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MONEY_LIMITS.maxLoans).map((l) => {
    if (!isObj(l) || !money(l.emi) || !str(l.name, MONEY_LIMITS.maxName)) return null;
    const totalMonths = Number.isInteger(l.totalMonths) && l.totalMonths > 0 && l.totalMonths <= MONEY_LIMITS.maxMonths ? l.totalMonths : null;
    const dueDay = Number.isInteger(l.dueDay) && l.dueDay >= 1 && l.dueDay <= 31 ? l.dueDay : null;
    if (!totalMonths || !dueDay) return null;
    const paid = isObj(l.paid) ? Object.fromEntries(Object.keys(l.paid).filter((k) => MONTH_RE.test(k)).map((k) => [k, true])) : {};
    const paidBefore = Number.isInteger(l.paidBefore) && l.paidBefore >= 0 && l.paidBefore <= totalMonths ? l.paidBefore : 0;
    return { name: str(l.name, MONEY_LIMITS.maxName), emi: l.emi, dueDay, totalMonths, paidBefore, paid };
  }).filter(Boolean);
}

function cleanIous(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MONEY_LIMITS.maxIous).map((i) => {
    if (!isObj(i) || (i.dir !== 'in' && i.dir !== 'out') || !money(i.amount) || !str(i.person, MONEY_LIMITS.maxName)) return null;
    const payments = Array.isArray(i.payments)
      ? i.payments.filter((p) => isObj(p) && money(p.amount)).map((p) => ({ amount: p.amount }))
      : [];
    return {
      dir: i.dir, person: str(i.person, MONEY_LIMITS.maxName), amount: i.amount,
      due: DATE_RE.test(i.due) ? i.due : null, note: str(i.note, MONEY_LIMITS.maxNote), payments,
    };
  }).filter(Boolean);
}

function cleanMessages(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((m) => isObj(m) && ROLES.has(m.role) && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_CHARS) }));
}

export async function POST(req) {
  const configError = coachConfigError();
  if (configError) return bad(`AI coach is not configured: ${configError}`, 503);

  if (!hit('coach:' + clientIp(req), COACH_MAX_REQUESTS, COACH_WINDOW_MS).ok) {
    return bad('Buddy needs a short break — try again in a few minutes.', 429);
  }

  if (Number(req.headers.get('content-length')) > MAX_BODY_BYTES) return bad('Request too large.', 413);

  let body;
  try { body = await req.json(); } catch { return bad('Invalid JSON.'); }
  if (!isObj(body)) return bad('Invalid request.');

  const messages = cleanMessages(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return bad('Send a message to Buddy.');
  }

  const ctx = isObj(body.context) ? body.context : {};
  const today = cleanDay(ctx.today);
  if (!today) return bad('Missing or invalid "today".');

  const days = (Array.isArray(ctx.days) ? ctx.days : [])
    .map(cleanDay).filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, MAX_DAYS);
  const weeks = (Array.isArray(ctx.weeks) ? ctx.weeks : [])
    .map(cleanWeek).filter(Boolean)
    .sort((a, b) => (a.week < b.week ? 1 : -1))
    .slice(0, MAX_WEEKS);
  const streak = Number.isInteger(ctx.streak) && ctx.streak >= 0 ? ctx.streak : 0;
  const plan = normalizePlan(ctx.plan);
  const programWeek = Number.isInteger(ctx.programWeek) && ctx.programWeek >= 1 && ctx.programWeek <= plan.program.weeks
    ? ctx.programWeek : 1;
  const customCats = cleanCustomCats(ctx.customCats);
  const catIds = new Set([...BUILTIN_CAT_IDS, ...customCats.map((c) => c.id)]);
  const expenses = cleanExpenses(ctx.expenses, today.date, catIds);
  const budget = Number.isFinite(ctx.budget) && ctx.budget > 0 && ctx.budget <= SPEND_LIMITS.maxBudget
    ? ctx.budget : defaultBudget(plan);
  const loans = cleanLoans(ctx.loans);
  const ious = cleanIous(ctx.ious);
  const now = typeof ctx.now === 'string' && /^\d{1,2}:\d{2}( [AP]M)?$/.test(ctx.now) ? ctx.now : '';

  /* Turn provider failures into a message the user can act on. */
  function explain(error) {
    const status = error?.statusCode ?? error?.lastError?.statusCode;
    const name = error?.name || error?.lastError?.name || '';
    console.error('[coach] model request failed:', status ?? '', name, error?.message ?? error);
    if (status === 401 || status === 403) return 'The AI key was rejected — check GROQ_API_KEY.';
    if (status === 404) return 'The AI model was not found — check COACH_MODEL.';
    if (status === 413) return 'That conversation is too long for the AI — tap “Clear chat” and ask again.';
    if (status === 429) return 'The AI is rate-limited right now — try again in a minute.';
    if (status >= 500) return 'The AI service is busy — try again in a moment.';
    if (/abort|timeout/i.test(name)) return 'The AI took too long to answer — try again.';
    return 'Buddy couldn\u2019t answer right now — try again.';
  }

  const result = streamText({
    model: coachModel(),
    system: buildSystemPrompt({ today, days, weeks, streak, programWeek, now, expenses, budget, customCats, loans, ious, plan }),
    messages,
    maxRetries: MODEL_RETRIES,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: AbortSignal.any([req.signal, AbortSignal.timeout(MODEL_TIMEOUT_MS)]),
    onError: () => { /* handled in the stream below */ },
  });

  /* Stream plain text; on failure append ERROR_MARK + a readable reason
     so the browser never sees a silent, empty reply. */
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let sent = false;
      try {
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta' && part.text) {
            controller.enqueue(encoder.encode(part.text));
            sent = true;
          } else if (part.type === 'error') {
            throw part.error;
          } else if (part.type === 'finish' && !sent) {
            const reason = part.finishReason === 'length'
              ? 'Buddy thought for too long and ran out of space — ask a shorter or more specific question.'
              : 'Buddy had no answer this time — try rephrasing.';
            controller.enqueue(encoder.encode(ERROR_MARK + reason));
          }
        }
      } catch (error) {
        controller.enqueue(encoder.encode(ERROR_MARK + explain(error)));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
