'use client';

/* Alert centre — everything due now across Money, Routine, Checklist
   and Meals, plus per-section switches and phone notifications. */

import { useEffect, useRef } from 'react';
import Icon from '@/components/Icon';
import { ALERT_SECTIONS } from '@/lib/constants';

const LEVEL_TEXT = { urgent: 'Urgent', warn: 'Heads up', info: 'Reminder' };

function notifySupport() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;   // 'default' | 'granted' | 'denied'
}

export default function AlertsPanel({ alerts, prefs, onPrefs, onOpen, onClose }) {
  const closeRef = useRef(null);
  const support = notifySupport();

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function toggleNotify() {
    if (prefs.notify) return onPrefs({ notify: false });
    const result = support === 'granted' ? 'granted' : await Notification.requestPermission();
    onPrefs({ notify: result === 'granted' });
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alerts-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-head">
          <h2 id="alerts-title"><Icon name="bell" size={20} className="inline-icon" /> Alerts</h2>
          <button ref={closeRef} type="button" className="icon-btn-sm" onClick={onClose} aria-label="Close alerts">
            <Icon name="x" size={20} />
          </button>
        </div>

        {alerts.length === 0 ? (
          <p className="muted small empty-alerts">All clear — nothing needs you right now.</p>
        ) : (
          <ul className="alert-list">
            {alerts.map((a) => (
              <li key={a.id}>
                <button type="button" className={`alert-item lvl-${a.level}`} onClick={() => onOpen(a)}>
                  <span className="alert-icon"><Icon name={a.icon} size={18} /></span>
                  <span className="alert-text">
                    <span className="alert-level">{LEVEL_TEXT[a.level]}</span>
                    <b>{a.title}</b>
                    <span className="muted small">{a.body}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <h3 className="section-title settings-title">Alert settings</h3>
        <ul className="switch-list">
          {ALERT_SECTIONS.map((s) => {
            const on = prefs[s.id] !== false;
            return (
              <li key={s.id}>
                <span>
                  <b>{s.label}</b>
                  <span className="muted small">{s.hint}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${s.label} alerts`}
                  className={`switch${on ? ' on' : ''}`}
                  onClick={() => onPrefs({ [s.id]: !on })}
                >
                  <i />
                </button>
              </li>
            );
          })}
          <li>
            <span>
              <b>Phone notifications</b>
              <span className="muted small">
                {support === 'unsupported' && 'Not supported in this browser.'}
                {support === 'denied' && 'Blocked — allow notifications for this site in browser settings.'}
                {(support === 'default' || support === 'granted') && 'Pops up while the app is open or running in the background.'}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={!!prefs.notify}
              aria-label="Phone notifications"
              className={`switch${prefs.notify ? ' on' : ''}`}
              disabled={support === 'unsupported' || support === 'denied'}
              onClick={toggleNotify}
            >
              <i />
            </button>
          </li>
        </ul>
      </section>
    </div>
  );
}
