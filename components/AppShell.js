'use client';

/* =================================================================
   AppShell — header (alerts bell), tab content, bottom navigation.
   The active tab lives in the URL hash (#today, #money/loans …) so
   tabs are deep-linkable, survive a refresh, and notification taps
   land on the right section.
   ================================================================= */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import TodayView from '@/components/TodayView';
import MealsView from '@/components/MealsView';
import ReviewView from '@/components/ReviewView';
import MoneyView, { MONEY_SECTIONS } from '@/components/MoneyView';
import BuddyView from '@/components/BuddyView';
import AlertsPanel from '@/components/AlertsPanel';
import SettingsView from '@/components/SettingsView';
import { useRoutineStore } from '@/components/useRoutineStore';
import { useAlertNotifier, useServiceWorker, useInstallPrompt } from '@/components/usePwa';
import { todayStr } from '@/lib/tracker';
import { buildAlerts } from '@/lib/alerts';

const TABS = [
  { id: 'today',  label: 'Today',  icon: 'sun' },
  { id: 'meals',  label: 'Meals',  icon: 'utensils' },
  { id: 'money',  label: 'Money',  icon: 'wallet' },
  { id: 'buddy',  label: 'Buddy',  icon: 'sparkles' },
  { id: 'review', label: 'Review', icon: 'chart' },
];
const DEFAULT_TAB = TABS[0].id;
const DEFAULT_MONEY = MONEY_SECTIONS[0].id;
const PAGES = ['settings'];                               // reachable from the header, not the tab bar
const LEGACY_TABS = { spend: 'money', health: 'meals' };   // old bookmarks

/* '#money/loans' -> { tab: 'money', sub: 'loans' } */
function readHash() {
  const [rawTab, rawSub] = window.location.hash.slice(1).split('/');
  const tab = LEGACY_TABS[rawTab] || rawTab;
  const valid = TABS.some((t) => t.id === tab) || PAGES.includes(tab);
  const sub = MONEY_SECTIONS.some((s) => s.id === rawSub) ? rawSub : DEFAULT_MONEY;
  return { tab: valid ? tab : DEFAULT_TAB, sub };
}

export default function AppShell() {
  const store = useRoutineStore();
  const { state, now } = store;
  const [tab, setTab] = useState(DEFAULT_TAB);
  const [moneySub, setMoneySub] = useState(DEFAULT_MONEY);
  const [pendingPrompt, setPendingPrompt] = useState('');   // question handed to Buddy from another tab
  const [alertsOpen, setAlertsOpen] = useState(false);
  const router = useRouter();

  useServiceWorker();
  const installer = useInstallPrompt();

  useEffect(() => {
    const sync = () => { const h = readHash(); setTab(h.tab); setMoneySub(h.sub); };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const alerts = useMemo(() => (state && now ? buildAlerts(state, now) : []), [state, now]);
  useAlertNotifier(alerts, !!state?.alertPrefs?.notify, state?.alertNotified || [], store.markAlertsNotified);

  const go = useCallback((id, sub) => {
    const nextSub = id === 'money' ? sub || moneySub : null;
    window.history.pushState(null, '', '#' + id + (nextSub ? '/' + nextSub : ''));
    setTab(id);
    if (nextSub) setMoneySub(nextSub);
    window.scrollTo({ top: 0 });
  }, [moneySub]);

  function setSection(sub) {
    window.history.replaceState(null, '', '#money/' + sub);
    setMoneySub(sub);
  }

  function askBuddy(text) {
    setPendingPrompt(text);
    go('buddy');
  }

  function openAlerts() {
    setAlertsOpen(true);
    store.markAlertsSeen(alerts.map((a) => a.id));
  }

  const closeAlerts = useCallback(() => setAlertsOpen(false), []);

  async function logout() {
    try { await fetch('/api/logout', { method: 'POST' }); } catch { /* ignore */ }
    router.replace('/login');
  }

  if (!state || !now) {
    return <div className="boot" aria-busy="true">Loading your day…</div>;
  }

  const today = todayStr(now);
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = state.plan.profile.name;
  const seen = new Set(state.alertSeen);
  const unseen = alerts.filter((a) => !seen.has(a.id)).length;
  const urgent = alerts.some((a) => a.level === 'urgent');

  return (
    <div className="app">
      <div className="bg-blobs" aria-hidden="true"><i /><i /><i /></div>

      <header className="topbar">
        <div>
          <p className="eyebrow">{dateLabel}</p>
          <h1>{greeting}{name ? `, ${name}` : ''}</h1>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="icon-btn bell"
            onClick={openAlerts}
            aria-label={unseen ? `Alerts, ${unseen} new` : `Alerts, ${alerts.length} active`}
          >
            <Icon name="bell" size={20} />
            {unseen > 0 && <span className={`badge${urgent ? ' urgent' : ''}`} aria-hidden="true">{unseen}</span>}
          </button>
          <button
            type="button"
            className={`icon-btn${tab === 'settings' ? ' on' : ''}`}
            onClick={() => go('settings')}
            aria-label="Settings"
          >
            <Icon name="gear" size={20} />
          </button>
          <button type="button" className="icon-btn" onClick={logout} aria-label="Log out">
            <Icon name="logout" size={20} />
          </button>
        </div>
      </header>

      <main className="content" id="main">
        {tab === 'today' && (
          <>
            {!state.installDismissed && (installer.mode === 'prompt' || installer.mode === 'ios') && (
              <section className="glass install-card">
                <img src="/icons/icon-192.png" alt="" width="48" height="48" />
                <div className="now-body">
                  <h3>Install Day to Day</h3>
                  <p className="muted small">
                    {installer.mode === 'ios'
                      ? 'Tap Share, then “Add to Home Screen” — it opens full-screen like an app.'
                      : 'Add it to your home screen — full-screen, faster, with reminders.'}
                  </p>
                  <div className="btn-row">
                    <button type="button" className="btn btn-ghost" onClick={store.dismissInstall}>Not now</button>
                    {installer.mode === 'prompt' && (
                      <button type="button" className="btn btn-primary" onClick={installer.install}>Install</button>
                    )}
                  </div>
                </div>
              </section>
            )}
            {state.plan.isTemplate && (
              <section className="glass install-card">
                <span className="now-icon"><Icon name="gear" size={22} /></span>
                <div className="now-body">
                  <h3>Make it yours</h3>
                  <p className="muted small">You’re on the starter plan. Add your timetable, meals and prices — or import your plan file.</p>
                  <div className="btn-row">
                    <button type="button" className="btn btn-primary" onClick={() => go('settings')}>Open Settings</button>
                  </div>
                </div>
              </section>
            )}
            <TodayView state={state} now={now} today={today} toggleCheck={store.toggleCheck} onGo={go} />
          </>
        )}
        {tab === 'meals' && <MealsView key={today} plan={state.plan} today={today} onAsk={askBuddy} />}
        {tab === 'settings' && <SettingsView state={state} store={store} onDone={() => go('today')} />}
        {tab === 'money' && (
          <MoneyView section={moneySub} onSection={setSection} state={state} today={today} store={store} onAsk={askBuddy} />
        )}
        {tab === 'buddy' && (
          <BuddyView
            state={state}
            now={now}
            today={today}
            appendChat={store.appendChat}
            clearChat={store.clearChat}
            pendingPrompt={pendingPrompt}
            onPromptUsed={() => setPendingPrompt('')}
          />
        )}
        {tab === 'review' && (
          <ReviewView
            state={state}
            today={today}
            setWeekField={store.setWeekField}
            restartProgram={store.restartProgram}
            onAsk={askBuddy}
          />
        )}
      </main>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'on' : undefined}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => go(t.id)}
          >
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {alertsOpen && (
        <AlertsPanel
          alerts={alerts}
          prefs={state.alertPrefs}
          onPrefs={store.setAlertPrefs}
          onOpen={(a) => { closeAlerts(); go(a.tab, a.sub); }}
          onClose={closeAlerts}
        />
      )}
    </div>
  );
}
