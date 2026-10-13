'use client';

/* Owe — money others owe me and money I owe, with due dates and
   partial payments. Repaying someone is also logged in Spend. */

import { useState } from 'react';
import Icon from '@/components/Icon';
import { MONEY_LIMITS } from '@/lib/constants';
import { parseDate } from '@/lib/tracker';
import { iouStatus, moneyTotals, dueText, dueLevel } from '@/lib/money';
import { formatRupees } from '@/lib/food';

const DIRS = {
  in:  { label: 'They owe me', icon: 'arrowDown', verb: 'Received' },
  out: { label: 'I owe',       icon: 'arrowUp',   verb: 'Paid' },
};
const shortDate = (key) => parseDate(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function AddIou({ onAdd, onClose }) {
  const [f, setF] = useState({ dir: 'in', person: '', amount: '', due: '', note: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    const person = f.person.trim().slice(0, MONEY_LIMITS.maxName);
    const amount = Math.round(Number(f.amount) * 100) / 100;
    if (!person) return setError('Who is it with?');
    if (!(amount > 0 && amount <= MONEY_LIMITS.maxAmount)) return setError('Enter the amount.');
    onAdd({ dir: f.dir, person, amount, due: f.due || null, note: f.note.trim().slice(0, MONEY_LIMITS.maxNote) });
    onClose();
  }

  return (
    <form className="glass money-form" onSubmit={submit}>
      <h3>Add money owed</h3>
      <div className="segmented two" role="group" aria-label="Direction">
        {Object.entries(DIRS).map(([id, d]) => (
          <button key={id} type="button" aria-pressed={f.dir === id} className={f.dir === id ? 'on' : undefined} onClick={() => setF((x) => ({ ...x, dir: id }))}>
            {d.label}
          </button>
        ))}
      </div>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Person</span>
          <input type="text" maxLength={MONEY_LIMITS.maxName} placeholder="e.g. Ravi" value={f.person} onChange={set('person')} autoFocus />
        </label>
        <label className="field">
          <span className="field-label">Amount (₹)</span>
          <input type="number" inputMode="decimal" min="1" step="any" value={f.amount} onChange={set('amount')} />
        </label>
        <label className="field wide">
          <span className="field-label">Due date <span className="muted">(optional — enables alerts)</span></span>
          <input type="date" value={f.due} onChange={set('due')} />
        </label>
        <label className="field wide">
          <span className="field-label">Note <span className="muted">(optional)</span></span>
          <input type="text" maxLength={MONEY_LIMITS.maxNote} placeholder="e.g. trip share, hand loan" value={f.note} onChange={set('note')} />
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
}

function IouCard({ iou, today, soonDays, onPay, onUndo, onRemove }) {
  const s = iouStatus(iou, today);
  const [paying, setPaying] = useState(false);
  const [amt, setAmt] = useState('');
  const [error, setError] = useState('');
  const level = s.settled ? 'paid' : dueLevel(s.daysUntil, soonDays);
  const dir = DIRS[iou.dir];

  function pay(e) {
    e.preventDefault();
    const n = Math.round(Number(amt || s.remaining) * 100) / 100;
    if (!(n > 0 && n <= s.remaining)) return setError(`Enter up to ${formatRupees(s.remaining)}.`);
    onPay(iou.id, n, today);
    setPaying(false);
    setAmt('');
    setError('');
  }

  function remove() {
    if (window.confirm(`Delete this record with ${iou.person}?`)) onRemove(iou.id);
  }

  return (
    <li className={`glass loan due-${level}`}>
      <div className="loan-head">
        <span className={`spend-icon dir-${iou.dir}`}><Icon name={dir.icon} size={18} /></span>
        <span className="loan-title">
          <b>{iou.person}</b>
          <span className="muted small">{iou.note || dir.label}{s.paid > 0 ? ` · ${formatRupees(s.paid)} of ${formatRupees(iou.amount)} done` : ''}</span>
        </span>
        <span className="iou-amt">{formatRupees(s.remaining)}</span>
        <button type="button" className="icon-btn-sm" aria-label={`Delete record with ${iou.person}`} onClick={remove}>
          <Icon name="trash" size={16} />
        </button>
      </div>

      {(iou.payments || []).length > 0 && (
        <ul className="payments">
          {iou.payments.map((p) => (
            <li key={p.id}>
              <span className="muted small">{dir.verb} {formatRupees(p.amount)} · {shortDate(p.date)}</span>
              <button type="button" className="link-btn" onClick={() => onUndo(iou.id, p.id)}>Undo</button>
            </li>
          ))}
        </ul>
      )}

      {!s.settled && (paying ? (
        <form className="pay-form" onSubmit={pay}>
          <label className="field">
            <span className="field-label">{dir.verb} amount (₹)</span>
            <input type="number" inputMode="decimal" min="1" step="any" placeholder={String(s.remaining)} value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="btn-row">
            <button type="button" className="btn btn-ghost" onClick={() => { setPaying(false); setError(''); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      ) : (
        <div className="loan-foot">
          <span className={`due-chip ${level}`}>{iou.due ? `${dueText(s.daysUntil)} · ${shortDate(iou.due)}` : 'No due date'}</span>
          <button type="button" className="btn btn-soft small-btn" onClick={() => setPaying(true)}>
            <Icon name="check" size={16} /> {iou.dir === 'in' ? 'Got paid' : 'Pay back'}
          </button>
        </div>
      ))}
      {s.settled && <span className="due-chip paid">Settled</span>}
    </li>
  );
}

export default function OweView({ state, today, addIou, removeIou, payIou, undoIouPayment, onAsk }) {
  const [adding, setAdding] = useState(false);
  const [showSettled, setShowSettled] = useState(false);
  const t = moneyTotals([], state.ious, today);
  const open = state.ious.filter((i) => !iouStatus(i, today).settled);
  const settled = state.ious.filter((i) => iouStatus(i, today).settled);
  const card = (i) => (
    <IouCard key={i.id} iou={i} today={today} soonDays={state.plan.reminders.dueSoonDays} onPay={payIou} onUndo={undoIouPayment} onRemove={removeIou} />
  );

  return (
    <div className="stack">
      <section className="glass">
        <div className="stat-row">
          <div><span className="muted small">They owe me</span><b className="text-in">{formatRupees(t.owedToMe)}</b></div>
          <div><span className="muted small">I owe</span><b className="text-out">{formatRupees(t.iOwe)}</b></div>
          <div><span className="muted small">Net</span><b>{t.net < 0 ? '−' : ''}{formatRupees(Math.abs(t.net))}</b></div>
        </div>
        <p className="muted small">Paying someone back also adds it to Spend under “Repayments”.</p>
      </section>

      {adding ? (
        <AddIou onAdd={addIou} onClose={() => setAdding(false)} />
      ) : (
        state.ious.length < MONEY_LIMITS.maxIous && (
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} /> Add money owed
          </button>
        )
      )}

      {['in', 'out'].map((d) => {
        const list = open.filter((i) => i.dir === d);
        if (!list.length) return null;
        return (
          <section key={d}>
            <h3 className="list-title">{DIRS[d].label}</h3>
            <ul className="loan-list">{list.map(card)}</ul>
          </section>
        );
      })}

      {open.length === 0 && !adding && (
        <p className="glass muted small empty">Nothing pending. Add who owes you — or who you owe — to get reminders.</p>
      )}

      {settled.length > 0 && (
        <section>
          <button type="button" className="link-btn" onClick={() => setShowSettled((v) => !v)} aria-expanded={showSettled}>
            {showSettled ? 'Hide' : 'Show'} settled ({settled.length})
          </button>
          {showSettled && <ul className="loan-list">{settled.map(card)}</ul>}
        </section>
      )}

      {open.length > 0 && (
        <button
          type="button"
          className="btn btn-soft full"
          onClick={() => onAsk('Look at the money I owe and that others owe me. What should I settle first, and how do I politely remind people?')}
        >
          <Icon name="sparkles" size={18} /> Sort my dues with Buddy
        </button>
      )}
    </div>
  );
}
