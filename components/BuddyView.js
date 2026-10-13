'use client';

/* Buddy tab — chat with the AI coach. Replies stream in; history is
   kept on this device. Buddy sees the plan and your logged data. */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { QUICK_PROMPTS } from '@/lib/coach';
import { addDays, computeStreak, programPosition } from '@/lib/tracker';
import { defaultBudget } from '@/lib/spend';

const HISTORY_DAYS = 28;
const HISTORY_WEEKS = 4;
const SPEND_DAYS = 14;
const SEND_MESSAGES = 20;
const MAX_INPUT = 2000;

/* The logged data Buddy needs, from this browser's store. */
function buildContext(state, today, now) {
  const from = addDays(today, -HISTORY_DAYS);
  return {
    today: { date: today, done: state.days[today]?.done || {} },
    days: Object.entries(state.days)
      .filter(([date]) => date >= from && date <= today)
      .map(([date, d]) => ({ date, done: d.done || {} })),
    weeks: Object.entries(state.weeks)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .slice(0, HISTORY_WEEKS)
      .map(([week, values]) => ({ week, values })),
    streak: computeStreak(state.plan, state.days, today),
    programWeek: programPosition(state.plan, state.programStart, today).week,
    now: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    expenses: Object.fromEntries(Object.entries(state.expenses).filter(([date]) => date >= addDays(today, -SPEND_DAYS))),
    budget: state.budget ?? defaultBudget(state.plan),
    plan: state.plan,
    customCats: state.customCats,
    loans: state.loans,
    ious: state.ious,
  };
}

// **bold** or *italic* spans, as written by the model.
const EMPHASIS_RE = /(\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*)/g;

/* Renders the model's **bold** / *italic* as React elements only —
   never raw HTML, so replies can't inject markup. */
function RichText({ text }) {
  return text.split(EMPHASIS_RE).map((p, i) => {
    if (i % 2 === 0) return p;
    return p.startsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <em key={i}>{p.slice(1, -1)}</em>;
  });
}

export default function BuddyView({ state, now, today, appendChat, clearChat, pendingPrompt, onPromptUsed }) {
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(null);   // reply text while it streams
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const router = useRouter();
  const busy = streaming !== null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [state.chat.length, streaming]);

  async function send(text) {
    const content = text.trim().slice(0, MAX_INPUT);
    if (!content || busy) return;
    const userMsg = { role: 'user', content, at: new Date().toISOString() };
    const history = [...state.chat, userMsg].slice(-SEND_MESSAGES).map(({ role, content: c }) => ({ role, content: c }));

    appendChat([userMsg]);
    setInput('');
    setError('');
    setStreaming('');

    let reply = '';
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context: buildContext(state, today, now) }),
      });
      if (res.status === 401) { router.replace('/login'); return; }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Buddy is unavailable right now.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setStreaming(reply);
      }
      if (!reply.trim()) throw new Error('Buddy didn’t answer — check the API key and COACH_MODEL, then try again.');
      appendChat([{ role: 'assistant', content: reply.trim(), at: new Date().toISOString() }]);
    } catch (e) {
      setError(e instanceof TypeError ? 'Could not reach Buddy. Check your connection.' : e.message);
    } finally {
      setStreaming(null);
    }
  }

  // A question handed over from another tab (e.g. Meals) is sent once.
  useEffect(() => {
    if (pendingPrompt && !busy) {
      onPromptUsed();
      send(pendingPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt]);

  function onSubmit(e) {
    e.preventDefault();
    send(input);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function onClear() {
    if (window.confirm('Clear the whole conversation on this device?')) clearChat();
  }

  const empty = state.chat.length === 0 && !busy;

  return (
    <div className="stack chat">
      <section className="glass">
        <div className="section-head">
          <h3><Icon name="sparkles" size={18} className="inline-icon" /> Ask Buddy</h3>
          {state.chat.length > 0 && (
            <button type="button" className="link-btn" onClick={onClear}>Clear chat</button>
          )}
        </div>
        <p className="muted small">
          Ask anything — food swaps, hunger, gym, study, budget. Buddy knows your plan and what you&apos;ve logged.
        </p>
        <div className="chips chips-scroll">
          {QUICK_PROMPTS.map((p) => (
            <button key={p.id} type="button" className="chip chip-btn" disabled={busy} onClick={() => send(p.text)}>
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="messages" aria-live="polite" aria-busy={busy}>
        {empty && (
          <div className="glass bubble bubble-ai">
            Hi{state.plan.profile.name ? ` ${state.plan.profile.name}` : ''}! Tap a suggestion above or type your question below.
          </div>
        )}
        {state.chat.map((m) => (
          <div key={m.at + m.role} className={`bubble ${m.role === 'user' ? 'bubble-me' : 'glass bubble-ai'}`}>
            {m.role === 'assistant' ? <RichText text={m.content} /> : m.content}
          </div>
        ))}
        {busy && (
          <div className="glass bubble bubble-ai">
            {streaming ? <RichText text={streaming} /> : <span className="typing" aria-label="Buddy is typing"><i /><i /><i /></span>}
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div ref={endRef} />
      </section>

      <form className="composer glass" onSubmit={onSubmit}>
        <label htmlFor="buddy-input" className="sr-only">Message Buddy</label>
        <textarea
          id="buddy-input"
          rows={1}
          value={input}
          maxLength={MAX_INPUT}
          placeholder="Ask Buddy anything…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="send-btn" disabled={busy || !input.trim()} aria-label="Send">
          <Icon name="send" size={20} />
        </button>
      </form>
    </div>
  );
}
