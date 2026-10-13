'use client';

/* Spend tab — log every rupee, see the weekly food budget, a safe
   daily limit, and where the money goes compared with last week. */

import { useState } from 'react';
import Icon from '@/components/Icon';
import { SPEND_LIMITS, FALLBACK_CATEGORY } from '@/lib/constants';
import { addDays, parseDate } from '@/lib/tracker';
import { weekSummary, defaultBudget, allCategories } from '@/lib/spend';
import { formatRupees } from '@/lib/food';

const byId = (cats) => Object.fromEntries(cats.map((c) => [c.id, c]));
const shortDate = (key) => parseDate(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function BudgetCard({ sum, onSaveBudget }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(sum.budget));
  const [error, setError] = useState('');

  function save(e) {
    e.preventDefault();
    const n = Math.round(Number(draft));
    if (!Number.isFinite(n) || n <= 0 || n > SPEND_LIMITS.maxBudget) {
      setError('Enter a budget greater than ₹0.');
      return;
    }
    onSaveBudget(n);
    setEditing(false);
    setError('');
  }

  const level = sum.overWeek ? 'over' : sum.usedPct >= 85 ? 'near' : 'ok';

  return (
    <section className="glass">
      <div className="section-head">
        <h3>This week&apos;s food budget</h3>
        <span className="muted small">{shortDate(sum.monday)} – {shortDate(sum.sunday)}</span>
      </div>

      <div className="budget-figures">
        <b>{formatRupees(sum.thisWeek.food)}</b>
        <span className="muted">of {formatRupees(sum.budget)}</span>
      </div>
      <div
        className={`meter meter-${level}`}
        role="progressbar"
        aria-label="Food budget used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={sum.usedPct}
      >
        <i style={{ width: `${sum.usedPct}%` }} />
      </div>

      <div className="stat-row">
        <div>
          <span className="muted small">{sum.overWeek ? 'Over budget' : 'Left this week'}</span>
          <b className={sum.overWeek ? 'text-warn' : undefined}>{formatRupees(Math.abs(sum.remaining))}</b>
        </div>
        <div>
          <span className="muted small">Safe per day</span>
          <b>{formatRupees(Math.floor(sum.safeDaily))}</b>
        </div>
        <div>
          <span className="muted small">Days left</span>
          <b>{sum.daysLeft}</b>
        </div>
      </div>
      <p className="muted small">
        All spending this week: <b>{formatRupees(sum.thisWeek.total)}</b> (incl. travel &amp; other)
      </p>

      {editing ? (
        <form className="inline-form" onSubmit={save}>
          <label className="field">
            <span className="field-label">Weekly food budget (₹)</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={SPEND_LIMITS.maxBudget}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={!!error}
              autoFocus
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="btn-row">
            <button type="button" className="btn btn-ghost" onClick={() => { setEditing(false); setError(''); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      ) : (
        <button type="button" className="link-btn" onClick={() => { setDraft(String(sum.budget)); setEditing(true); }}>
          <Icon name="pencil" size={14} /> Change budget
        </button>
      )}
    </section>
  );
}

/* Inline form to create a custom category. */
function NewCategory({ cats, onCreate, onCancel }) {
  const [label, setLabel] = useState('');
  const [food, setFood] = useState(false);
  const [error, setError] = useState('');

  function create() {
    const name = label.trim().slice(0, SPEND_LIMITS.maxCatLabel);
    if (!name) { setError('Give the category a name.'); return; }
    if (cats.some((c) => c.label.toLowerCase() === name.toLowerCase())) { setError('That category already exists.'); return; }
    onCreate({ label: name, food });
  }

  return (
    <div className="new-cat">
      <label className="field">
        <span className="field-label">New category name</span>
        <input
          type="text"
          maxLength={SPEND_LIMITS.maxCatLabel}
          placeholder="e.g. Rent, Phone recharge, Bills"
          value={label}
          onChange={(e) => { setLabel(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
          aria-invalid={!!error}
          autoFocus
        />
      </label>
      <label className="check-line">
        <input type="checkbox" checked={food} onChange={(e) => setFood(e.target.checked)} />
        <span>Counts toward the weekly food budget</span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-soft" onClick={create}>Create</button>
      </div>
    </div>
  );
}

function AddExpense({ today, cats, onAdd, onAddCategory, onRemoveCategory }) {
  const CAT = byId(cats);
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState(cats[0].id);
  const [creating, setCreating] = useState(false);
  const canCreate = cats.filter((c) => c.custom).length < SPEND_LIMITS.maxCustomCats;
  const [note, setNote] = useState('');
  const [when, setWhen] = useState('today');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  function createCategory(c) {
    setCat(onAddCategory(c));
    setCreating(false);
  }

  function removeSelected() {
    const c = CAT[cat];
    if (window.confirm(`Remove "${c.label}"? Its past entries will be counted under Other.`)) {
      onRemoveCategory(c.id);
      setCat(cats[0].id);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (!CAT[cat]) { setError('Pick a category.'); return; }
    const n = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(n) || n <= 0 || n > SPEND_LIMITS.maxAmount) {
      setError(`Enter an amount between ₹1 and ${formatRupees(SPEND_LIMITS.maxAmount)}.`);
      return;
    }
    const date = when === 'today' ? today : addDays(today, -1);
    onAdd(date, { cat, amount: n, note: note.trim().slice(0, SPEND_LIMITS.maxNote) });
    setSaved(`Added ${formatRupees(n)} · ${CAT[cat].label}`);
    setAmount('');
    setNote('');
    setError('');
  }

  return (
    <section className="glass" id="add-spend">
      <h3 className="section-title">Add spending</h3>
      <form className="spend-form" onSubmit={submit}>
        <div className="segmented two" role="group" aria-label="Day">
          {['today', 'yesterday'].map((w) => (
            <button key={w} type="button" aria-pressed={when === w} className={when === w ? 'on' : undefined} onClick={() => setWhen(w)}>
              {w === 'today' ? 'Today' : 'Yesterday'}
            </button>
          ))}
        </div>

        <label className="field">
          <span className="field-label">Amount (₹)</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            max={SPEND_LIMITS.maxAmount}
            placeholder="e.g. 120"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setSaved(''); }}
            aria-invalid={!!error}
            aria-describedby={error ? 'spend-error' : undefined}
          />
        </label>

        <fieldset className="cat-picker">
          <legend className="field-label">Category</legend>
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`cat${cat === c.id ? ' on' : ''}`}
              aria-pressed={cat === c.id}
              onClick={() => setCat(c.id)}
            >
              <Icon name={c.icon} size={18} />
              <span>{c.label}</span>
            </button>
          ))}
          {canCreate && !creating && (
            <button type="button" className="cat cat-new" onClick={() => setCreating(true)}>
              <Icon name="plus" size={18} />
              <span>New</span>
            </button>
          )}
        </fieldset>
        {creating && <NewCategory cats={cats} onCreate={createCategory} onCancel={() => setCreating(false)} />}
        {CAT[cat]?.custom && !creating && (
          <p className="muted small cat-meta">
            {CAT[cat].food ? 'Counts toward the food budget.' : 'Tracked outside the food budget.'}{' '}
            <button type="button" className="link-btn danger" onClick={removeSelected}>
              <Icon name="x" size={14} /> Remove category
            </button>
          </p>
        )}

        <label className="field">
          <span className="field-label">Note <span className="muted">(optional)</span></span>
          <input
            type="text"
            maxLength={SPEND_LIMITS.maxNote}
            placeholder="e.g. chicken 600 g, tea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {error && <p className="form-error" id="spend-error" role="alert">{error}</p>}
        {saved && <p className="form-ok" role="status">{saved}</p>}
        <button type="submit" className="btn btn-primary"><Icon name="plus" size={18} /> Add</button>
      </form>
    </section>
  );
}

function DayList({ title, date, entries, cats, onRemove }) {
  const CAT = byId(cats);
  const total = entries.reduce((a, e) => a + e.amount, 0);
  return (
    <section className="glass">
      <div className="section-head">
        <h3>{title}</h3>
        <span className="muted small">{shortDate(date)} · {formatRupees(Math.round(total * 100) / 100)}</span>
      </div>
      {entries.length === 0 ? (
        <p className="muted small">Nothing logged yet.</p>
      ) : (
        <ul className="spend-list">
          {entries.map((e) => (
            <li key={e.id}>
              <span className="spend-icon"><Icon name={(CAT[e.cat] || CAT[FALLBACK_CATEGORY]).icon} size={18} /></span>
              <span className="spend-text">
                <b>{(CAT[e.cat] || CAT[FALLBACK_CATEGORY]).label}</b>
                {e.note && <span className="muted small">{e.note}</span>}
              </span>
              <span className="spend-amt">{formatRupees(e.amount)}</span>
              <button
                type="button"
                className="icon-btn-sm"
                aria-label={`Delete ${formatRupees(e.amount)} ${(CAT[e.cat] || CAT[FALLBACK_CATEGORY]).label}`}
                onClick={() => onRemove(date, e.id)}
              >
                <Icon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Breakdown({ sum }) {
  const max = Math.max(1, ...sum.cats.flatMap((c) => [sum.thisWeek.byCat[c.id], sum.lastWeek.byCat[c.id]]));
  return (
    <section className="glass">
      <div className="section-head">
        <h3>Where it goes</h3>
        <span className="muted small">This week vs last</span>
      </div>
      <ul className="breakdown">
        {sum.cats.map((c) => {
          const now = sum.thisWeek.byCat[c.id];
          const prev = sum.lastWeek.byCat[c.id];
          const diff = Math.round(now - prev);
          return (
            <li key={c.id}>
              <div className="bd-head">
                <span><Icon name={c.icon} size={16} className="inline-icon" /> {c.label}</span>
                <span className="bd-nums">
                  <b>{formatRupees(now)}</b>
                  {diff !== 0 && (
                    <span className={diff > 0 ? 'delta up' : 'delta down'}>
                      {diff > 0 ? '▲' : '▼'} {formatRupees(Math.abs(diff))}
                    </span>
                  )}
                </span>
              </div>
              <div className="bd-bars" aria-hidden="true">
                <i className="bar-now" style={{ width: `${(now / max) * 100}%` }} />
                <i className="bar-prev" style={{ width: `${(prev / max) * 100}%` }} />
              </div>
              <span className="sr-only">Last week {formatRupees(prev)}</span>
            </li>
          );
        })}
      </ul>
      <div className="legend">
        <span><i className="swatch now" />This week</span>
        <span><i className="swatch prev" />Last week</span>
      </div>
    </section>
  );
}

export default function SpendView({
  state, today, addExpense, removeExpense, setBudget, addCategory, removeCategory, onAsk,
}) {
  const budget = state.budget ?? defaultBudget(state.plan);
  const cats = allCategories(state.customCats);
  const sum = weekSummary(state.expenses, today, budget, cats);
  const yesterday = addDays(today, -1);

  return (
    <div className="stack">
      <BudgetCard key={budget} sum={sum} onSaveBudget={setBudget} />
      <AddExpense
        today={today}
        cats={cats}
        onAdd={addExpense}
        onAddCategory={addCategory}
        onRemoveCategory={removeCategory}
      />
      <DayList title="Today" date={today} entries={state.expenses[today] || []} cats={cats} onRemove={removeExpense} />
      {(state.expenses[yesterday] || []).length > 0 && (
        <DayList title="Yesterday" date={yesterday} entries={state.expenses[yesterday]} cats={cats} onRemove={removeExpense} />
      )}
      <Breakdown sum={sum} />
      <button
        type="button"
        className="btn btn-soft full"
        onClick={() => onAsk('Look at my spending this week versus my budget and last week. Where exactly can I cut, and which cheaper swaps from my plan keep my protein up?')}
      >
        <Icon name="sparkles" size={18} /> Ask Buddy how to spend less
      </button>
    </div>
  );
}
