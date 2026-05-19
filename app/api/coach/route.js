/* POST /api/coach — run the AI coach. STATELESS.

   The browser sends its own data with the request; this route asks the
   AI and returns the answer. It stores NOTHING — no database, no files.
   Its only job is to hold the AI key safely on the server side.

   body: { mode, today: {date, done}, history: [{date, done, status, score}], streak } */

import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { cerebras } from '@ai-sdk/cerebras';
import { summarize } from '@/lib/tasks';
import { buildCoachRequest } from '@/lib/coach';

const MODES = ['daily', 'patterns', 'weekly', 'phase2'];

export async function POST(req) {
  try {
    let body;
    try { body = await req.json(); } catch { body = {}; }

    const mode = MODES.includes(body.mode) ? body.mode : 'daily';

    const today = body.today && typeof body.today === 'object' ? body.today : {};
    const todayDone = today.done && typeof today.done === 'object' ? today.done : {};
    const ts = summarize(todayDone);
    const todayRow = {
      date: typeof today.date === 'string' ? today.date : '',
      done: todayDone,
      status: ts.status,
      score: ts.score,
    };

    const rows = (Array.isArray(body.history) ? body.history : [])
      .filter((h) => h && typeof h.date === 'string')
      .map((h) => ({
        date: h.date,
        done: h.done && typeof h.done === 'object' ? h.done : {},
        status: h.status || 'BROKEN',
        score: Number.isFinite(h.score) ? h.score : 0,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 35);

    const streak = Number.isFinite(body.streak) ? body.streak : 0;

    const { system, prompt } = buildCoachRequest(mode, { todayRow, rows, streak });

    // Cerebras provider — reads CEREBRAS_API_KEY from the environment.
    const { text } = await generateText({
      model: cerebras(process.env.COACH_MODEL || 'gpt-oss-120b'),
      system,
      prompt,
    });

    const content = (text || '').trim() || 'Buddy had nothing to add this time.';

    return NextResponse.json({
      success: true,
      data: { mode, content, date: todayRow.date, created_at: new Date().toISOString() },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
