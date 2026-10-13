'use client';

/* Small pop-up inviting phone users to install the app (PWA).
   Shows on mobile only, a few seconds after opening, until the app is
   installed. "Not now" snoozes it; iPhone gets Add-to-Home-Screen steps
   because Safari has no install button. */

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { INSTALL_PROMPT_DELAY_MS } from '@/lib/constants';

export default function InstallPopup({ installer, snoozedUntil, today, onSnooze }) {
  const [visible, setVisible] = useState(false);
  const eligible =
    installer.mobile &&
    (installer.mode === 'prompt' || installer.mode === 'ios') &&
    !(snoozedUntil && snoozedUntil > today);

  useEffect(() => {
    if (!eligible) { setVisible(false); return undefined; }
    const t = setTimeout(() => setVisible(true), INSTALL_PROMPT_DELAY_MS);
    return () => clearTimeout(t);
  }, [eligible]);

  if (!visible) return null;
  const ios = installer.mode === 'ios';

  function later() {
    setVisible(false);
    onSnooze();
  }

  return (
    <aside className="install-pop glass" role="dialog" aria-labelledby="install-title" aria-live="polite">
      <img src="/icons/icon-192.png" alt="" width="44" height="44" />
      <div className="install-pop-body">
        <b id="install-title">Get the Day to Day app</b>
        {ios ? (
          <span className="muted small">
            Tap <span className="ios-share" aria-label="Share"><Icon name="arrowUp" size={13} /></span> Share,
            then <b>Add to Home Screen</b>.
          </span>
        ) : (
          <span className="muted small">Full-screen, works offline, keeps your data safe.</span>
        )}
        <div className="install-pop-actions">
          <button type="button" className="btn btn-ghost small-btn" onClick={later}>Not now</button>
          {!ios && (
            <button type="button" className="btn btn-primary small-btn" onClick={installer.install}>
              <Icon name="arrowDown" size={16} /> Install
            </button>
          )}
          {ios && <button type="button" className="btn btn-soft small-btn" onClick={later}>Got it</button>}
        </div>
      </div>
      <button type="button" className="icon-btn-sm install-pop-close" aria-label="Close" onClick={later}>
        <Icon name="x" size={18} />
      </button>
    </aside>
  );
}
