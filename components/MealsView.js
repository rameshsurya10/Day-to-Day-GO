'use client';

/* Meals tab — the day's menu item by item, its protein and calcium
   sources, plus portions, the calcium plan, shopping budget and health
   notes. All content comes from the user's plan (Settings). */

import { useState } from 'react';
import Icon from '@/components/Icon';
import HealthView from '@/components/HealthView';
import { FOOD_TAGS } from '@/lib/constants';
import { parseDate } from '@/lib/tracker';
import { dayName, sourcesFor, shoppingTotals, formatRupees, slotTime } from '@/lib/food';

const DAY_TABS = [1, 2, 3, 4, 5, 6, 0];
const SLOT_ICON = { breakfast: 'sunrise', lunch: 'sun', snack: 'flame', dinner: 'moon' };

function TagBadges({ tags }) {
  if (!tags.length) return null;
  return (
    <span className="tags">
      {tags.map((t) => <span key={t} className={`tag tag-${t}`}>{FOOD_TAGS[t]}</span>)}
    </span>
  );
}

function SourceRow({ label, tag, items }) {
  if (!items.length) return null;
  return (
    <div className="source-row">
      <span className={`tag tag-${tag}`}>{label}</span>
      <span className="source-list">{items.join(' · ')}</span>
    </div>
  );
}

export default function MealsView({ plan, today, onAsk }) {
  const todayDow = parseDate(today).getDay();
  const [dow, setDow] = useState(todayDow);
  const { meals, calcium, shopping, health } = plan;
  const menu = meals.days[dow];
  const name = dayName(dow);
  const totals = shoppingTotals(plan);
  const hasPortions = meals.quantityGuide.length > 0 || meals.hungerRule || meals.restDayRule;
  const hasHealth = health.priorities.length > 0 || health.cards.length > 0 || health.warning;

  return (
    <div className="stack">
      <section className="glass">
        <div className="section-head">
          <h3>Food chart</h3>
          <span className="muted small">{dow === todayDow ? 'Today' : 'Preview'}</span>
        </div>
        <div className="segmented" role="group" aria-label="Day of week">
          {DAY_TABS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dow === d}
              className={dow === d ? 'on' : undefined}
              onClick={() => setDow(d)}
            >
              {dayName(d).slice(0, 3)}
              {d === todayDow && <i className="today-dot" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </section>

      {menu ? (
        <>
          <section className="glass day-summary">
            <p className="eyebrow">{dow === todayDow ? 'Today' : name}&apos;s plan at a glance</p>
            <SourceRow label="Protein" tag="protein" items={sourcesFor(plan, dow, 'protein')} />
            <SourceRow label="Calcium" tag="calcium" items={sourcesFor(plan, dow, 'calcium')} />
            <button
              type="button"
              className="btn btn-soft full"
              onClick={() => onAsk(`Explain ${name}'s meals for me: why each meal, portion tips, and what I can swap if something isn't available.`)}
            >
              <Icon name="sparkles" size={18} /> Ask Buddy about {name}&apos;s meals
            </button>
          </section>

          <ul className="meal-list">
            {meals.slots.filter((slot) => (menu[slot.id] || []).length).map((slot) => (
              <li key={slot.id} className="glass meal">
                <div className="meal-head">
                  <span className="meal-icon"><Icon name={SLOT_ICON[slot.id]} size={20} /></span>
                  <span className="meal-title">
                    <b>{slot.label}</b>
                    <span className="muted small">{slotTime(slot)}</span>
                  </span>
                </div>
                <ul className="food-items">
                  {menu[slot.id].map((it, i) => (
                    <li key={i}>
                      <span className="food-name">
                        {it.food}
                        <TagBadges tags={it.tags} />
                      </span>
                      <span className="food-qty">{it.qty}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <section className="glass now-card">
          <div className="now-icon"><Icon name="home" size={22} /></div>
          <div className="now-body">
            <h3>Sunday — home food</h3>
            <p className="muted">{plan.sunday.food || 'A flexible day.'}</p>
          </div>
        </section>
      )}

      {hasPortions && (
      <details className="glass accordion" open>
        <summary><Icon name="info" size={18} /> Portions &amp; hunger rule</summary>
        {meals.quantityGuide.length > 0 && (
          <ul className="bullets">
            {meals.quantityGuide.map((q) => <li key={q}>{q}</li>)}
          </ul>
        )}
        {(meals.hungerRule || meals.restDayRule) && (
          <div className="callout">
            <Icon name="utensils" size={18} />
            <p><b>Hunger rule.</b> {meals.hungerRule} {meals.restDayRule}</p>
          </div>
        )}
      </details>
      )}

      {calcium.items.length > 0 && (
      <details className="glass accordion">
        <summary><Icon name="droplet" size={18} /> {calcium.title}</summary>
        {calcium.target && <p className="muted small">{calcium.target}</p>}
        <ul className="calcium-list">
          {calcium.items.map((c) => (
            <li key={c.title}>
              <div className="calcium-head">
                <b>{c.title}</b>
                <span className="tag tag-calcium">{c.amount}</span>
              </div>
              <p className="muted small">{c.body}</p>
            </li>
          ))}
        </ul>
        {calcium.note && <div className="callout"><Icon name="alert" size={18} /><p>{calcium.note}</p></div>}
      </details>
      )}

      {totals.hasList && (
      <details className="glass accordion">
        <summary><Icon name="cart" size={18} /> Weekly shopping &amp; budget</summary>
        <div className="budget-total">
          <span className="muted small">Estimated per week</span>
          <b>{formatRupees(totals.min)} – {formatRupees(totals.max)}</b>
          <span className="muted small">
            {plan.program.weeks} weeks: {formatRupees(totals.programMin)} – {formatRupees(totals.programMax)}
          </span>
        </div>
        <div className="table-wrap">
          <table className="trend shop">
            <thead>
              <tr><th scope="col">Item</th><th scope="col">Per week</th><th scope="col">Cost</th></tr>
            </thead>
            <tbody>
              {shopping.items.map((r) => (
                <tr key={r.item}>
                  <th scope="row">{r.item}</th>
                  <td>{r.qty}</td>
                  <td className="num">{formatRupees(r.min)}–{r.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="bullets small-list">
          {shopping.note && <li>{shopping.note}</li>}
          {shopping.tips.map((n) => <li key={n}>{n}</li>)}
        </ul>
        <button
          type="button"
          className="btn btn-ghost full"
          onClick={() => onAsk('Help me plan this week\u2019s grocery shopping within budget, and where I can save without losing protein.')}
        >
          <Icon name="sparkles" size={18} /> Plan shopping with Buddy
        </button>
      </details>
      )}

      {hasHealth && (
        <details className="glass accordion">
          <summary><Icon name="heart" size={18} /> Health &amp; priorities</summary>
          <HealthView health={health} />
        </details>
      )}
    </div>
  );
}
