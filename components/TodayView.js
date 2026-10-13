'use client';

/* Today tab — progress ring, "right now" block, checklist, timeline. */

import Icon from '@/components/Icon';
import {
  checksFor, summarize, computeStreak, programPosition, currentBlock, formatTime, isSunday,
} from '@/lib/tracker';
import { weekSummary, defaultBudget, allCategories } from '@/lib/spend';
import { formatRupees } from '@/lib/food';
import { loanStatus, iouStatus, dueText } from '@/lib/money';

const UPCOMING_DAYS = 7;
const UPCOMING_MAX = 4;

const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;

function ProgressRing({ count, total }) {
  const pct = total ? count / total : 0;
  return (
    <div className="ring" role="img" aria-label={`${count} of ${total} checks done`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="ring-track" cx="50" cy="50" r={RING_R} />
        <circle
          className="ring-fill"
          cx="50" cy="50" r={RING_R}
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - pct)}
        />
      </svg>
      <div className="ring-label">
        <b>{count}</b><span>/ {total}</span>
      </div>
    </div>
  );
}

function formatLeft(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m left` : `${m}m left`;
}

/* Today's spend vs the safe daily limit, with a warning when over. */
function SpendCard({ state, today, onGo }) {
  const sum = weekSummary(state.expenses, today, state.budget ?? defaultBudget(state.plan), allCategories(state.customCats));
  const over = sum.overToday;
  return (
    <section className={`glass spend-card${over ? ' warn' : ''}`}>
      <div className="now-icon"><Icon name={over ? 'alert' : 'wallet'} size={22} /></div>
      <div className="now-body">
        <p className="eyebrow">{over ? 'Over today\u2019s safe limit' : 'Spent today'}</p>
        <h3>
          {formatRupees(sum.today.total)}
          <span className="muted small"> · safe {formatRupees(Math.floor(sum.safeDaily))}/day for food</span>
        </h3>
        <p className="muted small">
          {sum.overWeek
            ? `Food budget is ${formatRupees(Math.abs(sum.remaining))} over this week.`
            : `${formatRupees(sum.remaining)} of ${formatRupees(sum.budget)} left this week.`}
        </p>
      </div>
      <button type="button" className="icon-btn" onClick={() => onGo('money', 'spend')} aria-label="Add spending">
        <Icon name="plus" size={20} />
      </button>
    </section>
  );
}

/* EMIs and money owed falling due within a week (or overdue). */
function ComingUp({ state, today, onGo }) {
  const items = [
    ...state.loans.map((l) => ({ l, s: loanStatus(l, today) }))
      .filter(({ s }) => !s.finished && !s.paidThisMonth && s.daysUntil <= UPCOMING_DAYS)
      .map(({ l, s }) => ({ id: l.id, icon: 'landmark', text: `${l.name} EMI`, amount: l.emi, days: s.daysUntil, sub: 'loans' })),
    ...state.ious.map((i) => ({ i, s: iouStatus(i, today) }))
      .filter(({ s }) => !s.settled && s.daysUntil !== null && s.daysUntil <= UPCOMING_DAYS)
      .map(({ i, s }) => ({
        id: i.id, icon: i.dir === 'in' ? 'arrowDown' : 'arrowUp',
        text: i.dir === 'in' ? `${i.person} owes you` : `You owe ${i.person}`,
        amount: s.remaining, days: s.daysUntil, sub: 'owe',
      })),
  ].sort((a, b) => a.days - b.days).slice(0, UPCOMING_MAX);

  if (!items.length) return null;
  return (
    <section className="glass">
      <div className="section-head">
        <h3>Coming up</h3>
        <span className="muted small">Next {UPCOMING_DAYS} days</span>
      </div>
      <ul className="spend-list">
        {items.map((it) => (
          <li key={it.id}>
            <span className="spend-icon"><Icon name={it.icon} size={18} /></span>
            <span className="spend-text">
              <b>{it.text}</b>
              <span className={`small ${it.days < 0 ? 'text-warn' : 'muted'}`}>{dueText(it.days)}</span>
            </span>
            <span className="spend-amt">{formatRupees(it.amount)}</span>
            <button type="button" className="icon-btn-sm" aria-label={`Open ${it.text}`} onClick={() => onGo('money', it.sub)}>
              <Icon name="chevron" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function TodayView({ state, now, today, toggleCheck, onGo }) {
  const done = state.days[today]?.done || {};
  const { count, total, kept } = summarize(state.plan, today, done);
  const streak = computeStreak(state.plan, state.days, today);
  const pos = programPosition(state.plan, state.programStart, today);
  const sunday = isSunday(today);
  const block = currentBlock(state.plan, now);
  const blocks = state.plan.timetable;
  const nowBlock = block ? blocks[block.index] : null;

  return (
    <div className="stack">
      <section className="glass hero">
        <div className="hero-text">
          <p className="eyebrow">Week {pos.week} of {state.plan.program.weeks} · Day {pos.day}/{pos.total}</p>
          <h2 className="hero-title">
            {kept ? 'Day kept. Nice work.' : sunday ? 'Home & recovery day' : 'Keep the chain going'}
          </h2>
          <div className="chips">
            <span className="chip"><Icon name="flame" size={16} />{streak} day streak</span>
            {kept && <span className="chip chip-ok"><Icon name="check" size={16} />Kept</span>}
          </div>
        </div>
        <ProgressRing count={count} total={total} />
      </section>

      <section className="glass now-card">
        {nowBlock ? (
          <>
            <div className="now-icon"><Icon name={nowBlock.icon} size={22} /></div>
            <div className="now-body">
              <p className="eyebrow">Right now · {formatLeft(block.minutesLeft)}</p>
              <h3>{nowBlock.title}</h3>
              <p className="muted">{nowBlock.note}</p>
            </div>
          </>
        ) : (
          <>
            <div className="now-icon"><Icon name="home" size={22} /></div>
            <div className="now-body">
              <p className="eyebrow">Sunday</p>
              <h3>Go home, rest, prepare</h3>
              <p className="muted">Flexible day — but back to your normal bedtime tonight.</p>
            </div>
          </>
        )}
      </section>

      <SpendCard state={state} today={today} onGo={onGo} />
      <ComingUp state={state} today={today} onGo={onGo} />

      <section className="glass">
        <div className="section-head">
          <h3>Today&apos;s checklist</h3>
          <span className="muted small">{count}/{total}</span>
        </div>
        <ul className="checklist">
          {checksFor(state.plan, today).map((c) => {
            const on = !!done[c.id];
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`check${on ? ' on' : ''}`}
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggleCheck(today, c.id)}
                >
                  <span className="check-icon"><Icon name={c.icon} size={20} /></span>
                  <span className="check-text">
                    <b>{c.label}</b>
                    <span>{c.hint}</span>
                  </span>
                  <span className="check-box"><Icon name="check" size={16} /></span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="muted small foot-note">Consistency, not a perfect score.</p>
      </section>

      <section className="glass">
        <div className="section-head">
          <h3>{sunday ? 'Sunday plan' : 'Timeline'}</h3>
          <span className="muted small">{sunday ? 'Flexible' : 'Mon – Sat'}</span>
        </div>
        {sunday ? (
          <ul className="bullets">
            {state.plan.sunday.plan.map((t) => <li key={t}>{t}</li>)}
          </ul>
        ) : (
          <ol className="timeline">
            {blocks.map((b, i) => (
              <li key={b.start} className={block?.index === i ? 'current' : undefined}>
                <span className="tl-time">{formatTime(b.start)}</span>
                <span className="tl-dot" aria-hidden="true" />
                <span className="tl-body">
                  <b>{b.title}</b>
                  <span>{b.note}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
