/* =================================================================
   coach.js — "Buddy", the AI coach.

   buildCoachRequest() turns your logged data into a prompt for the
   model. The COACH_PERSONA constant below is the single biggest lever
   on how the app FEELS — it defines Buddy's voice and judgement.
   Edit it freely; this is your call, not a fixed implementation.
   ================================================================= */

import { TASKS, LEVELS } from '@/lib/tasks';

/* ── TUNE THIS ──────────────────────────────────────────────────────
   The persona. Make Buddy as harsh, warm, brief, or detailed as you
   want. Whatever you write here is what Buddy becomes.                */
export const COACH_PERSONA = `You are "Buddy", a personal performance coach for one operator
running a demanding double-shift schedule: a 5:30 AM trading class, an
office job, a night coding block, and a 9:30 PM trading class.

Your philosophy — never compromise on it:
- The system is built on 3 levels. Level 1 is non-negotiable; Level 2
  is the standard baseline; Level 3 is bonus, never expected.
- A day is only a real failure when Level 1 breaks. Surviving on Level 1
  alone is a WIN, not a loss — say so plainly.
- "Reduce effort, never remove the habit." Never tell him to skip;
  tell him to shrink the task.
- Consistency beats intensity. Warn hard against the
  "I'll compensate tomorrow" trap and against 2 missed days in a row.

Your voice:
- Direct, calm, and grounded. Address him as "Buddy".
- Honest — name what slipped without sugar-coating, but never shame.
- Concrete — point at specific tasks and days, not vague pep talk.
- Brief — every sentence must earn its place.
Use plain text. No markdown headers. Short paragraphs or tight lists.`;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayOf(dateStr) {
  return WEEKDAYS[new Date(dateStr + 'T00:00:00').getDay()];
}

/* Renders one day row with the exact tasks that were missed — this is
   what lets Buddy spot patterns like "workout slips on Fridays". */
function formatDay(row) {
  const done = row.done || {};
  const missed = [];
  for (const lvl of LEVELS) {
    for (const t of TASKS[lvl].items) {
      if (!done[t.id]) missed.push(t.label);
    }
  }
  const tail = missed.length ? ` | missed: ${missed.join('; ')}` : ' | everything done';
  return `${row.date} (${weekdayOf(row.date)}) — ${row.status} ${row.score}/100${tail}`;
}

const MODE_INSTRUCTIONS = {
  daily:
    'Give short, honest feedback on TODAY only (3-5 sentences). React to ' +
    'what was done and what is still open. If Level 1 is incomplete, make ' +
    'clear what must still happen before sleep.',
  patterns:
    'Study the history and identify 2-3 concrete, recurring patterns or ' +
    'risks (e.g. a task that fails on specific weekdays, a slipping streak). ' +
    'For each, name the evidence and give one specific fix.',
  weekly:
    'Write a short weekly report card for the last 7 days: what held, what ' +
    'slipped, the trend, and the single most important focus for next week.',
  phase2:
    'The operator is adapting well. Design his "Phase 2" upgrade: how to ' +
    'exit split-sleep toward ~7 hrs continuous, and a week-by-week ' +
    'progression so he keeps improving without burning out. Keep it actionable.',
};

export function buildCoachRequest(mode, ctx) {
  const { todayRow, rows, streak } = ctx;
  const history = rows
    .filter((r) => r.date !== todayRow.date)
    .map(formatDay)
    .join('\n');

  const prompt =
    `CURRENT STREAK: ${streak} day(s) without the system breaking.\n\n` +
    `TODAY:\n${formatDay(todayRow)}\n\n` +
    `HISTORY (most recent first):\n${history || '(no earlier days logged yet)'}\n\n` +
    `TASK: ${MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.daily}`;

  return { system: COACH_PERSONA, prompt };
}
