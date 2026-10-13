'use client';

/* Loans & EMIs — monthly EMIs with due dates, progress and one-tap
   "Mark paid" (which also logs the payment in Spend). */

import { useState } from 'react';
import Icon from '@/components/Icon';
import { MONEY_LIMITS } from '@/lib/constants';
import { parseDate } from '@/lib/tracker';
import { loanStatus, moneyTotals, dueText, dueLevel } from '@/lib/money';
import { formatRupees } from '@/lib/food';

const monthName = (month) => parseDate(month + '-01').toLocaleDateString(undefined, { month: 'short' });
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

function AddLoan({ onAdd, onClose }) {
  const [f, setF] = useState({ name: '', emi: '', dueDay: '', totalMonths: '', paidBefore: '0', note: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    const name = f.name.trim().slice(0, MONEY_LIMITS.maxName);
    const emi = Math.round(Number(f.emi) * 100) / 100;
    const dueDay = Number(f.dueDay);
    const totalMonths = Number(f.totalMonths);
    const paidBefore = Number(f.paidBefore || 0);
    if (!name) return setError('Give the loan a name (e.g. Bike loan).');
    if (!(emi > 0 && emi <= MONEY_LIMITS.maxAmount)) return setError('Enter the monthly EMI amount.');
    if (!(Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31)) return setError('Due day must be 1–31.');
    if (!(Number.isInteger(totalMonths) && totalMonths >= 1 && totalMonths <= MONEY_LIMITS.maxMonths)) return setError('Enter the total number of EMIs.');
    if (!(Number.isInteger(paidBefore) && paidBefore >= 0 && paidBefore < totalMonths)) return setError('EMIs already paid must be less than the total.');
    onAdd({ name, emi, dueDay, totalMonths, paidBefore, note: f.note.trim().slice(0, MONEY_LIMITS.maxNote) });
    onClose();
  }

  return (
    <form className="glass money-form" onSubmit={submit}>
      <h3>Add a loan or EMI</h3>
      <label className="field wide">
        <span className="field-label">Name</span>
        <input type="text" maxLength={MONEY_LIMITS.maxName} placeholder="e.g. Bike loan, Phone EMI" value={f.name} onChange={set('name')} autoFocus />
      </label>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">EMI (₹ / month)</span>
          <input type="number" inputMode="decimal" min="1" step="any" value={f.emi} onChange={set('emi')} />
        </label>
        <label className="field">
          <span className="field-label">Due day (1–31)</span>
          <input type="number" inputMode="numeric" min="1" max="31" value={f.dueDay} onChange={set('dueDay')} />
        </label>
        <label className="field">
          <span className="field-label">Total EMIs</span>
          <input type="number" inputMode="numeric" min="1" max={MONEY_LIMITS.maxMonths} placeholder="e.g. 24" value={f.totalMonths} onChange={set('totalMonths')} />
        </label>
        <label className="field">
          <span className="field-label">Already paid</span>
          <input type="number" inputMode="numeric" min="0" value={f.paidBefore} onChange={set('paidBefore')} />
        </label>
      </div>
      <label className="field wide">
        <span className="field-label">Note <span className="muted">(optional)</span></span>
        <input type="text" maxLength={MONEY_LIMITS.maxNote} placeholder="e.g. HDFC, auto-debit" value={f.note} onChange={set('note')} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save loan</button>
      </div>
    </form>
  );
}

function LoanCard({ loan, today, soonDays, onToggle, onRemove }) {
  const s = loanStatus(loan, today);
  const level = s.paidThisMonth ? 'paid' : s.finished ? 'done' : dueLevel(s.daysUntil, soonDays);

  function remove() {
    if (window.confirm(`Delete "${loan.name}"? Past EMI expenses stay in Spend.`)) onRemove(loan.id);
  }

  return (
    <li className={`glass loan due-${level}`}>
      <div className="loan-head">
        <span className="spend-icon"><Icon name="landmark" size={18} /></span>
        <span className="loan-title">
          <b>{loan.name}</b>
          <span className="muted small">
            {formatRupees(loan.emi)} · due {ordinal(loan.dueDay)}{loan.note ? ` · ${loan.note}` : ''}
          </span>
        </span>
        <button type="button" className="icon-btn-sm" aria-label={`Delete ${loan.name}`} onClick={remove}>
          <Icon name="trash" size={16} />
        </button>
      </div>

      <div className="loan-progress">
        <div className="meter" role="progressbar" aria-label={`${loan.name} EMIs paid`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.pct}>
          <i style={{ width: `${s.pct}%` }} />
        </div>
        <span className="muted small">
          {s.paidCount} of {loan.totalMonths} paid · {s.finished ? 'completed' : `≈ ${formatRupees(s.remainingAmount)} left`}
        </span>
      </div>

      {!s.finished || s.paidThisMonth ? (
        <div className="loan-foot">
          <span className={`due-chip ${level}`}>
            {s.paidThisMonth ? `Paid ${monthName(s.month)}` : dueText(s.daysUntil)}
          </span>
          <button
            type="button"
            className={`btn ${s.paidThisMonth ? 'btn-ghost' : 'btn-soft'} small-btn`}
            onClick={() => onToggle(loan.id, s.month, today)}
          >
            {s.paidThisMonth ? 'Undo' : <><Icon name="check" size={16} /> Mark {monthName(s.month)} paid</>}
          </button>
        </div>
      ) : (
        <span className="due-chip done">All EMIs paid</span>
      )}
    </li>
  );
}

export default function LoansView({ state, today, addLoan, removeLoan, toggleLoanPaid, onAsk }) {
  const [adding, setAdding] = useState(false);
  const t = moneyTotals(state.loans, [], today);
  const canAdd = state.loans.length < MONEY_LIMITS.maxLoans;

  return (
    <div className="stack">
      <section className="glass">
        <div className="section-head">
          <h3>EMIs this month</h3>
          <span className="muted small">{state.loans.length} loan{state.loans.length === 1 ? '' : 's'}</span>
        </div>
        <div className="stat-row">
          <div><span className="muted small">Due</span><b>{formatRupees(t.emiThisMonth)}</b></div>
          <div><span className="muted small">Paid</span><b>{formatRupees(t.emiPaidThisMonth)}</b></div>
          <div><span className="muted small">Total left</span><b>{formatRupees(Math.round(t.loanLeft))}</b></div>
        </div>
        <p className="muted small">Marking an EMI paid also adds it to Spend under “EMI &amp; loans”.</p>
      </section>

      {adding ? (
        <AddLoan onAdd={addLoan} onClose={() => setAdding(false)} />
      ) : (
        canAdd && (
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} /> Add loan / EMI
          </button>
        )
      )}

      {state.loans.length === 0 && !adding ? (
        <p className="glass muted small empty">No loans yet. Add one to get due-date alerts every month.</p>
      ) : (
        <ul className="loan-list">
          {state.loans.map((l) => (
            <LoanCard key={l.id} loan={l} today={today} soonDays={state.plan.reminders.dueSoonDays} onToggle={toggleLoanPaid} onRemove={removeLoan} />
          ))}
        </ul>
      )}

      {state.loans.length > 0 && (
        <button
          type="button"
          className="btn btn-soft full"
          onClick={() => onAsk('Look at my EMIs and loans. Which should I prioritise, and how do they fit with my food budget this month?')}
        >
          <Icon name="sparkles" size={18} /> Plan my EMIs with Buddy
        </button>
      )}
    </div>
  );
}
