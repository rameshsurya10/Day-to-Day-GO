/* Health & priorities — shown inside an accordion on the Meals tab.
   Content comes from the user's plan (Settings → Health). */

import Icon from '@/components/Icon';

export default function HealthView({ health }) {
  return (
    <div className="health">
      {health.priorities.length > 0 && (
        <ol className="priorities">
          {health.priorities.map((p) => (
            <li key={p.title}>
              <b>{p.title}</b>
              <span>{p.body}</span>
            </li>
          ))}
        </ol>
      )}

      {health.cards.length > 0 && (
        <ul className="health-list">
          {health.cards.map((c) => (
            <li key={c.title}>
              <span className="meal-icon"><Icon name={c.icon} size={18} /></span>
              <span>
                <b>{c.title}</b>
                <span className="muted small">{c.body}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {health.warning && (
        <div className="callout callout-warn" role="note">
          <Icon name="alert" size={18} />
          <p>{health.warning}</p>
        </div>
      )}
    </div>
  );
}
