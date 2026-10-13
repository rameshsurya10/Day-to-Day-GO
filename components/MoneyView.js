'use client';

/* Money tab — Spend · Loans & EMIs · Owe. The active section is
   controlled by AppShell so alerts can deep-link straight to it. */

import SpendView from '@/components/SpendView';
import LoansView from '@/components/LoansView';
import OweView from '@/components/OweView';

export const MONEY_SECTIONS = [
  { id: 'spend', label: 'Spend' },
  { id: 'loans', label: 'Loans & EMIs' },
  { id: 'owe',   label: 'Owe' },
];

export default function MoneyView({ section, onSection, state, today, store, onAsk }) {
  return (
    <div className="stack">
      <div className="segmented three glass-seg" role="group" aria-label="Money section">
        {MONEY_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={section === s.id}
            className={section === s.id ? 'on' : undefined}
            onClick={() => onSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'spend' && (
        <SpendView
          state={state}
          today={today}
          addExpense={store.addExpense}
          removeExpense={store.removeExpense}
          setBudget={store.setBudget}
          addCategory={store.addCategory}
          removeCategory={store.removeCategory}
          onAsk={onAsk}
        />
      )}
      {section === 'loans' && (
        <LoansView
          state={state}
          today={today}
          addLoan={store.addLoan}
          removeLoan={store.removeLoan}
          toggleLoanPaid={store.toggleLoanPaid}
          onAsk={onAsk}
        />
      )}
      {section === 'owe' && (
        <OweView
          state={state}
          today={today}
          addIou={store.addIou}
          removeIou={store.removeIou}
          payIou={store.payIou}
          undoIouPayment={store.undoIouPayment}
          onAsk={onAsk}
        />
      )}
    </div>
  );
}
