'use client';

/* Review tab — week focus, Mon–Sun 4-week calendar, weekly log, trend. */

import Icon from '@/components/Icon';
import { WEEKLY_FIELDS } from '@/lib/constants';
import {
  addDays, summarize, computeStreak, programPosition, weekStart, parseDate,
} from '@/lib/tracker';
import { weekFoodSpend, allCategories } from '@/lib/spend';
import { formatRupees } from '@/lib/food';

const TREND_WEEKS = 4;
const TREND_FIELDS = WEEKLY_FIELDS.filter((f) => f.type === 'number');
const WEEKDAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function cellState(plan, key, today, days, startedOn) {
  if (key < startedOn) return 'before';
  if (key > today) return 'future';
  const s = summarize(plan, key, days[key]?.done);
  if (s.kept) return 'kept';
  return s.count > 0 ? 'partial' : 'missed';
}
const CELL_TEXT = { kept: 'kept', partial: 'partly done', missed: 'not logged', future: 'upcoming', before: 'before you started' };

function shortDate(key) {
  return parseDate(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
function longDate(key) {
  return parseDate(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function ReviewView({ state, today, setWeekField, restartProgram, onAsk }) {
  const pos = programPosition(state.plan, state.programStart, today);
  const streak = computeStreak(state.plan, state.days, today);
  const thisWeek = weekStart(today);
  const log = state.weeks[thisWeek] || {};

  const cells = Array.from({ length: pos.total }, (_, i) => {
    const key = addDays(pos.cycleStart, i);
    const d = parseDate(key);
    return {
      key,
      date: d.getDate(),
      month: d.getDate() === 1 || i === 0 ? d.toLocaleDateString(undefined, { month: 'short' }) : '',
      state: cellState(state.plan, key, today, state.days, pos.startedOn),
      today: key === today,
    };
  });
  const keptCount = cells.filter((c) => c.state === 'kept').length;

  const trend = Array.from({ length: TREND_WEEKS }, (_, i) => {
    const week = addDays(thisWeek, -7 * i);
    const kept = Array.from({ length: 7 }, (_, d) => addDays(week, d))
      .filter((k) => k <= today && summarize(state.plan, k, state.days[k]?.done).kept).length;
    return { week, values: state.weeks[week] || {}, kept, spend: weekFoodSpend(state.expenses, week, allCategories(state.customCats)) };
  });

  function onRestart() {
    if (window.confirm('Start a new 4-week cycle from this week? Your logs are kept.')) {
      restartProgram(today);
    }
  }

  return (
    <div className="stack">
      <section className="glass now-card">
        <div className="now-icon"><Icon name="calendar" size={22} /></div>
        <div className="now-body">
          <p className="eyebrow">Week {pos.week} focus</p>
          <p>{state.plan.program.weekFocus[pos.week - 1] || 'Keep going — consistency first.'}</p>
        </div>
      </section>

      <section className="glass">
        <div className="section-head">
          <h3>{state.plan.program.weeks}-week tracker</h3>
          <span className="muted small">{keptCount} kept · {streak} streak</span>
        </div>
        <p className="muted small cal-range">
          {shortDate(pos.cycleStart)} – {shortDate(pos.cycleEnd)} · week {pos.week} of {state.plan.program.weeks}
        </p>
        <div className="grid28 weekday-head" aria-hidden="true">
          {WEEKDAY_HEADERS.map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="grid28" role="list" aria-label="Days in this cycle">
          {cells.map((c) => (
            <div
              key={c.key}
              role="listitem"
              className={`cell ${c.state}${c.today ? ' today' : ''}`}
              aria-label={`${longDate(c.key)}: ${CELL_TEXT[c.state]}`}
              title={`${longDate(c.key)} — ${CELL_TEXT[c.state]}`}
            >
              {c.month && <small className="cell-month">{c.month}</small>}
              {c.date}
            </div>
          ))}
        </div>
        <div className="legend">
          <span><i className="cell kept" />Kept</span>
          <span><i className="cell partial" />Partly</span>
          <span><i className="cell missed" />Missed</span>
          <span><i className="cell future" />Upcoming</span>
        </div>
        <button type="button" className="btn btn-ghost small-btn" onClick={onRestart}>
          <Icon name="refresh" size={16} /> Start new cycle this week
        </button>
      </section>

      <section className="glass">
        <div className="section-head">
          <h3>This week&apos;s log</h3>
          <span className="muted small">Week of {shortDate(thisWeek)}</span>
        </div>
        <div className="form-grid">
          {WEEKLY_FIELDS.map((f) => (
            <label key={f.id} className={`field${f.type === 'text' ? ' wide' : ''}`}>
              <span className="field-label">{f.label}{f.unit ? ` (${f.unit})` : ''}</span>
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                inputMode={f.type === 'number' ? 'decimal' : undefined}
                min={f.type === 'number' ? 0 : undefined}
                max={f.max}
                step="any"
                maxLength={f.maxLength}
                placeholder={f.placeholder}
                value={log[f.id] ?? ''}
                onChange={(e) => setWeekField(thisWeek, f.id, e.target.value)}
              />
            </label>
          ))}
        </div>
        <p className="muted small foot-note">Saved automatically on this device.</p>
      </section>

      <section className="glass">
        <h3 className="section-title">Last {TREND_WEEKS} weeks</h3>
        <div className="table-wrap">
          <table className="trend">
            <thead>
              <tr>
                <th scope="col">Week</th>
                {TREND_FIELDS.map((f) => <th scope="col" key={f.id}>{f.short}</th>)}
                <th scope="col">Food ₹</th>
                <th scope="col">Kept</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((w) => (
                <tr key={w.week}>
                  <th scope="row">{shortDate(w.week)}</th>
                  {TREND_FIELDS.map((f) => (
                    <td key={f.id}>{w.values[f.id] !== undefined && w.values[f.id] !== '' ? w.values[f.id] : '—'}</td>
                  ))}
                  <td>{w.spend ? formatRupees(Math.round(w.spend)) : '—'}</td>
                  <td>{w.kept}/7</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <button
        type="button"
        className="btn btn-soft full"
        onClick={() => onAsk('Review my last 7 days and my weekly log: what held, what slipped, and my single focus for next week.')}
      >
        <Icon name="sparkles" size={18} /> Weekly review with Buddy
      </button>
    </div>
  );
}
