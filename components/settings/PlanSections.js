'use client';

/* Editors for each part of the plan. Each receives the draft plan and
   `edit(fn)`, where fn mutates a copy of the draft. */

import { useState } from 'react';
import ListEditor, { LinesField } from '@/components/settings/ListEditor';
import { MEAL_DAYS, MEAL_SLOT_IDS } from '@/lib/constants';
import { dayName } from '@/lib/food';

const newId = (prefix) => prefix + Date.now().toString(36).slice(-5);
const TEXT = (key, label, extra = {}) => ({ key, label, type: 'text', ...extra });

function Input({ label, value, onChange, type = 'text', wide, placeholder, ...rest }) {
  return (
    <label className={`field${wide ? ' wide' : ''}`}>
      <span className="field-label">{label}</span>
      {type === 'textarea'
        ? <textarea rows={2} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        : <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} {...rest} />}
    </label>
  );
}

export function ProfileSection({ draft, edit }) {
  const p = draft.profile;
  const set = (k) => (v) => edit((d) => { d.profile[k] = v; });
  return (
    <div className="form-grid">
      <Input label="Your name (the coach uses it)" value={p.name} onChange={set('name')} placeholder="e.g. Arun" />
      <Input label="Region (for prices)" value={p.region} onChange={set('region')} placeholder="e.g. your state or city" />
      <Input label="Height" value={p.height} onChange={set('height')} placeholder="e.g. 170 cm" />
      <Input label="Weight" value={p.weight} onChange={set('weight')} placeholder="e.g. 70 kg" />
      <Input label="Diet notes" type="textarea" wide value={p.diet} onChange={set('diet')} placeholder="e.g. non-veg, no milk, budget South Indian" />
    </div>
  );
}

export function ProgramSection({ draft, edit }) {
  const g = draft.program;
  const set = (k) => (v) => edit((d) => { d.program[k] = v; });
  return (
    <div className="form-grid">
      <Input label="Cycle length (weeks)" type="number" min="1" max="12" value={g.weeks} onChange={set('weeks')} />
      <Input label="Day counts as kept at (%)" type="number" min="1" max="100" value={g.keptPct} onChange={set('keptPct')} />
      <Input label="Default weekly food budget (₹)" type="number" min="0" value={g.defaultBudget} onChange={set('defaultBudget')} wide />
      <LinesField label="Focus for each week" value={g.weekFocus} onChange={set('weekFocus')} placeholder="Week 1 focus…" />
    </div>
  );
}

export function TimetableSection({ draft, edit }) {
  return (
    <>
      <ListEditor
        items={draft.timetable}
        rowTitle={(b) => `${b.start || '--:--'} ${b.title || 'New block'}`}
        fields={[
          { key: 'start', label: 'Start', type: 'time' },
          { key: 'end', label: 'End', type: 'time' },
          TEXT('title', 'Title'),
          { key: 'icon', label: 'Icon', type: 'icon' },
          { key: 'note', label: 'Note', type: 'textarea', wide: true },
        ]}
        onChange={(v) => edit((d) => { d.timetable = v; })}
        makeNew={() => ({ start: '12:00', end: '12:30', icon: 'clock', title: '', note: '' })}
        addLabel="Add block"
      />
      <div className="form-grid">
        <LinesField label="Sunday plan" value={draft.sunday.plan} onChange={(v) => edit((d) => { d.sunday.plan = v; })} />
      </div>
    </>
  );
}

const CHECK_FIELDS = [TEXT('label', 'Label'), { key: 'icon', label: 'Icon', type: 'icon' }, TEXT('hint', 'Hint', { wide: true })];

export function ChecksSection({ draft, edit }) {
  return ['weekday', 'sunday'].map((k) => (
    <div key={k} className="sub-section">
      <h4>{k === 'weekday' ? 'Monday – Saturday' : 'Sunday'}</h4>
      <ListEditor
        items={draft.checks[k]}
        rowTitle={(c) => c.label || 'New check'}
        fields={CHECK_FIELDS}
        onChange={(v) => edit((d) => { d.checks[k] = v; })}
        makeNew={() => ({ id: newId('c'), icon: 'check', label: '', hint: '' })}
        addLabel="Add check"
      />
    </div>
  ));
}

export function MealsSection({ draft, edit }) {
  const [day, setDay] = useState(MEAL_DAYS[0]);
  const m = draft.meals;
  return (
    <>
      <h4>Meal times</h4>
      <div className="form-grid">
        {m.slots.map((s, i) => (
          <div key={s.id} className="slot-edit">
            <Input label="Name" value={s.label} onChange={(v) => edit((d) => { d.meals.slots[i].label = v; })} />
            <Input label="Time" type="time" value={s.at} onChange={(v) => edit((d) => { d.meals.slots[i].at = v; })} />
          </div>
        ))}
      </div>

      <h4>Menu</h4>
      <div className="segmented" role="group" aria-label="Day">
        {MEAL_DAYS.map((d) => (
          <button key={d} type="button" aria-pressed={day === d} className={day === d ? 'on' : undefined} onClick={() => setDay(d)}>
            {dayName(d).slice(0, 3)}
          </button>
        ))}
      </div>
      {MEAL_SLOT_IDS.map((sid) => (
        <div key={sid} className="sub-section">
          <h4>{m.slots.find((s) => s.id === sid)?.label || sid}</h4>
          <ListEditor
            items={m.days[day]?.[sid] || []}
            rowTitle={(f) => f.food || 'New food'}
            fields={[TEXT('food', 'Food'), TEXT('qty', 'Amount'), { key: 'tags', label: 'Tags', type: 'tags', wide: true }]}
            onChange={(v) => edit((d) => { d.meals.days[day] = { ...d.meals.days[day], [sid]: v }; })}
            makeNew={() => ({ food: '', qty: '', tags: [] })}
            addLabel="Add food"
            max={12}
          />
        </div>
      ))}
      <button
        type="button"
        className="link-btn"
        onClick={() => {
          if (window.confirm(`Copy ${dayName(day)}'s menu to every day Mon–Sat?`)) {
            edit((d) => { for (const x of MEAL_DAYS) d.meals.days[x] = structuredClone(d.meals.days[day]); });
          }
        }}
      >
        Copy {dayName(day)} to all days
      </button>

      <div className="form-grid">
        <Input label="Sunday food" type="textarea" wide value={draft.sunday.food} onChange={(v) => edit((d) => { d.sunday.food = v; })} />
        <LinesField label="Portion notes" value={m.quantityGuide} onChange={(v) => edit((d) => { d.meals.quantityGuide = v; })} />
        <Input label="Hunger rule" type="textarea" wide value={m.hungerRule} onChange={(v) => edit((d) => { d.meals.hungerRule = v; })} />
        <Input label="Rest-day rule" type="textarea" wide value={m.restDayRule} onChange={(v) => edit((d) => { d.meals.restDayRule = v; })} />
      </div>
    </>
  );
}

export function NutritionSection({ draft, edit }) {
  const c = draft.calcium;
  const set = (k) => (v) => edit((d) => { d.calcium[k] = v; });
  return (
    <>
      <div className="form-grid">
        <Input label="Section title" value={c.title} onChange={set('title')} />
        <Input label="Daily target" value={c.target} onChange={set('target')} />
      </div>
      <ListEditor
        items={c.items}
        rowTitle={(x) => x.title || 'New source'}
        fields={[TEXT('title', 'Food'), TEXT('amount', 'How much'), { key: 'body', label: 'Note', type: 'textarea', wide: true }]}
        onChange={set('items')}
        makeNew={() => ({ title: '', amount: '', body: '' })}
        addLabel="Add source"
      />
      <div className="form-grid">
        <Input label="Note" type="textarea" wide value={c.note} onChange={set('note')} />
      </div>
    </>
  );
}

export function ShoppingSection({ draft, edit }) {
  const s = draft.shopping;
  const set = (k) => (v) => edit((d) => { d.shopping[k] = v; });
  return (
    <>
      <ListEditor
        items={s.items}
        rowTitle={(r) => r.item || 'New item'}
        fields={[
          TEXT('item', 'Item'), TEXT('qty', 'Per week'),
          { key: 'min', label: 'Min ₹', type: 'number' }, { key: 'max', label: 'Max ₹', type: 'number' },
        ]}
        onChange={set('items')}
        makeNew={() => ({ item: '', qty: '', min: 0, max: 0 })}
        addLabel="Add item"
      />
      <div className="form-grid">
        <Input label="Price note" type="textarea" wide value={s.note} onChange={set('note')} placeholder="e.g. Approximate local prices" />
        <LinesField label="Money-saving tips" value={s.tips} onChange={set('tips')} />
      </div>
    </>
  );
}

export function HealthSection({ draft, edit }) {
  const h = draft.health;
  const set = (k) => (v) => edit((d) => { d.health[k] = v; });
  return (
    <>
      <h4>Priorities</h4>
      <ListEditor
        items={h.priorities}
        rowTitle={(x) => x.title || 'New priority'}
        fields={[TEXT('title', 'Title'), TEXT('body', 'Detail')]}
        onChange={set('priorities')}
        makeNew={() => ({ title: '', body: '' })}
        addLabel="Add priority"
      />
      <h4>Health notes</h4>
      <ListEditor
        items={h.cards}
        rowTitle={(x) => x.title || 'New note'}
        fields={[TEXT('title', 'Title'), { key: 'icon', label: 'Icon', type: 'icon' }, { key: 'body', label: 'Text', type: 'textarea', wide: true }]}
        onChange={set('cards')}
        makeNew={() => ({ icon: 'heart', title: '', body: '' })}
        addLabel="Add note"
      />
      <div className="form-grid">
        <Input label="Warning" type="textarea" wide value={h.warning} onChange={set('warning')} />
      </div>
    </>
  );
}

export function RemindersSection({ draft, edit }) {
  const r = draft.reminders;
  const set = (k) => (v) => edit((d) => { d.reminders[k] = v; });
  return (
    <>
      <ListEditor
        items={r.routine}
        rowTitle={(x) => `${x.at || '--:--'} ${x.title || 'New reminder'}`}
        fields={[
          { key: 'at', label: 'Time', type: 'time' },
          { key: 'days', label: 'Days', type: 'select', options: [{ value: 'weekdays', label: 'Mon–Sat' }, { value: 'all', label: 'Every day' }] },
          TEXT('title', 'Title'),
          { key: 'icon', label: 'Icon', type: 'icon' },
          { key: 'body', label: 'Message', type: 'textarea', wide: true },
        ]}
        onChange={set('routine')}
        makeNew={() => ({ id: newId('r'), at: '08:00', days: 'weekdays', icon: 'clock', title: '', body: '' })}
        addLabel="Add reminder"
      />
      <div className="form-grid">
        <Input label="Checklist nudge" type="time" value={r.checklistAt} onChange={set('checklistAt')} />
        <Input label="Log-spending nudge" type="time" value={r.spendAt} onChange={set('spendAt')} />
        <Input label="Sunday weekly-log nudge" type="time" value={r.weeklyLogAt} onChange={set('weeklyLogAt')} />
        <Input label="Warn about dues (days before)" type="number" min="0" max="30" value={r.dueSoonDays} onChange={set('dueSoonDays')} />
      </div>
    </>
  );
}
