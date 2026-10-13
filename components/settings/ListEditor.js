'use client';

/* Generic editor for a list of objects (timetable blocks, checks,
   foods, reminders …). `fields` describes the inputs:
     { key, label, type: 'text'|'textarea'|'time'|'number'|'select'|'icon'|'tags', options, wide, placeholder }
   Rows can be added, removed and moved. Edits are plain draft data;
   the Settings screen validates everything on Save. */

import { useState } from 'react';
import Icon from '@/components/Icon';
import { ICON_CHOICES, FOOD_TAGS, PLAN_LIMITS } from '@/lib/constants';

function Field({ field, value, onChange }) {
  const common = { value: value ?? '', onChange: (e) => onChange(e.target.value) };
  switch (field.type) {
    case 'textarea':
      return <textarea rows={2} maxLength={PLAN_LIMITS.maxBody} placeholder={field.placeholder} {...common} />;
    case 'time':
      return <input type="time" {...common} />;
    case 'number':
      return <input type="number" inputMode="decimal" min="0" step="any" {...common} />;
    case 'select':
    case 'icon': {
      const options = field.type === 'icon' ? ICON_CHOICES.map((v) => ({ value: v, label: v })) : field.options;
      return (
        <select {...common}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    case 'tags':
      return (
        <span className="tag-picks">
          {Object.entries(FOOD_TAGS).map(([t, label]) => {
            const on = (value || []).includes(t);
            return (
              <label key={t} className="check-line small-check">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onChange(on ? value.filter((x) => x !== t) : [...(value || []), t])}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </span>
      );
    default:
      return <input type="text" maxLength={PLAN_LIMITS.maxText} placeholder={field.placeholder} {...common} />;
  }
}

export default function ListEditor({
  items, fields, onChange, makeNew, addLabel = 'Add', max = PLAN_LIMITS.maxList, rowTitle,
}) {
  const update = (i, key, v) => onChange(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const move = (i, d) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div className="list-editor">
      {items.map((it, i) => (
        <fieldset key={i} className="edit-row">
          <legend className="edit-row-head">
            <span>{rowTitle ? rowTitle(it, i) : `#${i + 1}`}</span>
            <span className="edit-row-actions">
              <button type="button" className="icon-btn-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon name="arrowUp" size={16} />
              </button>
              <button type="button" className="icon-btn-sm" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                <Icon name="arrowDown" size={16} />
              </button>
              <button type="button" className="icon-btn-sm" aria-label="Remove row" onClick={() => remove(i)}>
                <Icon name="trash" size={16} />
              </button>
            </span>
          </legend>
          <div className="form-grid">
            {fields.map((f) => (
              <label key={f.key} className={`field${f.wide ? ' wide' : ''}`}>
                <span className="field-label">{f.label}</span>
                <Field field={f} value={it[f.key]} onChange={(v) => update(i, f.key, v)} />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {items.length < max && (
        <button type="button" className="btn btn-ghost small-btn" onClick={() => onChange([...items, makeNew()])}>
          <Icon name="plus" size={16} /> {addLabel}
        </button>
      )}
    </div>
  );
}

/* A list of plain strings, edited as one line per entry. Commits on
   blur so typing new lines isn't interrupted. */
export function LinesField({ label, value, onChange, placeholder }) {
  const [text, setText] = useState(value.join('\n'));
  return (
    <label className="field wide">
      <span className="field-label">{label} <span className="muted">(one per line)</span></span>
      <textarea
        rows={Math.min(8, Math.max(3, value.length + 1))}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(text.split('\n').map((l) => l.trim()).filter(Boolean))}
      />
    </label>
  );
}
