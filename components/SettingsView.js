'use client';

/* Settings — edit every part of the plan (saved in this browser) and
   manage data: persistent storage, backup export/import, reset.
   Edits go to a draft; "Save" validates and stores them. */

import { useState, useRef, useEffect } from 'react';
import Icon from '@/components/Icon';
import { backupFile, planFile } from '@/components/useRoutineStore';
import {
  ProfileSection, ProgramSection, TimetableSection, ChecksSection, MealsSection,
  NutritionSection, ShoppingSection, HealthSection, RemindersSection,
} from '@/components/settings/PlanSections';

const SECTIONS = [
  { id: 'profile',   icon: 'users',    title: 'Profile',            C: ProfileSection },
  { id: 'timetable', icon: 'clock',    title: 'Daily timetable',    C: TimetableSection },
  { id: 'checks',    icon: 'check',    title: 'Checklist',          C: ChecksSection },
  { id: 'meals',     icon: 'utensils', title: 'Meals & menu',       C: MealsSection },
  { id: 'nutrition', icon: 'droplet',  title: 'Nutrition plan',     C: NutritionSection },
  { id: 'shopping',  icon: 'cart',     title: 'Shopping & prices',  C: ShoppingSection },
  { id: 'health',    icon: 'heart',    title: 'Health & priorities', C: HealthSection },
  { id: 'reminders', icon: 'bell',     title: 'Reminders',          C: RemindersSection },
  { id: 'program',   icon: 'calendar', title: 'Program & budget',   C: ProgramSection },
];

function download({ filename, json }) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DataSection({ state, store, onImported }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setMsg({ error: 'File is too large.' }); return; }
    const result = store.importFile(await file.text());
    setMsg(result.ok ? { ok: result.message } : { error: result.error });
    if (result.ok) onImported();
  }

  function exportBackup() {
    download(backupFile(state));
    store.markBackedUp();
    setMsg({ ok: 'Backup downloaded — keep it somewhere safe (Drive, email to yourself).' });
  }

  return (
    <div className="data-section">
      <div className={`callout${store.persisted ? '' : ' callout-warn'}`}>
        <Icon name={store.persisted ? 'check' : 'alert'} size={18} />
        <p>
          {store.persisted
            ? 'Storage is protected — the browser won’t auto-delete your data.'
            : 'Your data is stored only in this browser. Clearing “site data” deletes it — keep a backup.'}
          {!store.persisted && (
            <> <button type="button" className="link-btn" onClick={store.protectStorage}>Protect storage</button></>
          )}
        </p>
      </div>
      <p className="muted small">
        Last backup: <b>{state.lastBackup || 'never'}</b>. Clearing the browser <i>cache</i> is safe; clearing <i>cookies &amp; site data</i> is not.
      </p>

      <div className="btn-col">
        <button type="button" className="btn btn-primary" onClick={exportBackup}>
          <Icon name="arrowDown" size={18} /> Download full backup
        </button>
        <button type="button" className="btn btn-soft" onClick={() => fileRef.current?.click()}>
          <Icon name="arrowUp" size={18} /> Import backup or plan file
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
        <button type="button" className="btn btn-ghost" onClick={() => download(planFile(state.plan))}>
          Export plan only
        </button>
      </div>
      {msg && <p className={msg.ok ? 'form-ok' : 'form-error'} role="status">{msg.ok || msg.error}</p>}

      <div className="danger-zone">
        <button
          type="button"
          className="link-btn danger"
          onClick={() => { if (window.confirm('Replace your plan with the starter template? Logs are kept.')) { store.resetPlan(); onImported(); } }}
        >
          Reset plan to starter
        </button>
        <button
          type="button"
          className="link-btn danger"
          onClick={() => { if (window.confirm('Delete ALL data on this device? Download a backup first.')) { store.clearAll(); onImported(); } }}
        >
          Delete all data
        </button>
      </div>
    </div>
  );
}

export default function SettingsView({ state, store, onDone }) {
  const [draft, setDraft] = useState(() => structuredClone(state.plan));
  const [version, setVersion] = useState(0);        // remounts editors after import/reset
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dataOpen] = useState(!state.lastBackup);   // decided once — a backup mustn't collapse it

  const edit = (fn) => {
    setDraft((d) => { const c = structuredClone(d); fn(c); return c; });
    setDirty(true);
    setSaved(false);
  };

  function save() {
    dirtyRef.current = false;
    setDirty(false);
    store.updatePlan(() => draft);     // updatePlan validates (normalizePlan)
    setSaved(true);
  }

  function discard() {
    setDraft(structuredClone(state.plan));
    setVersion((v) => v + 1);
    setDirty(false);
  }

  /* The stored plan changed (save, import, reset, another tab): show
     it, unless the user is midway through unsaved edits. */
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (dirtyRef.current) return;
    setDraft(structuredClone(state.plan));
    setVersion((v) => v + 1);
  }, [state.plan]);

  function afterImport() {
    setDirty(false);
    dirtyRef.current = false;
  }

  return (
    <div className="stack settings">
      <div className="section-head">
        <h2>Settings</h2>
        <button type="button" className="link-btn" onClick={onDone}>Done</button>
      </div>

      {state.plan.isTemplate && (
        <div className="callout">
          <Icon name="info" size={18} />
          <p>You’re using the starter plan. Edit the sections below, or import your own plan file in <b>Data &amp; backup</b>.</p>
        </div>
      )}

      {SECTIONS.map(({ id, icon, title, C }) => (
        <details key={id} className="glass accordion">
          <summary><Icon name={icon} size={18} /> {title}</summary>
          <div className="settings-body" key={version}>
            <C draft={draft} edit={edit} />
          </div>
        </details>
      ))}

      <details className="glass accordion" open={dataOpen}>
        <summary><Icon name="box" size={18} /> Data &amp; backup</summary>
        <DataSection state={state} store={store} onImported={afterImport} />
      </details>

      {(dirty || saved) && (
        <div className="save-bar glass" role="status">
          {dirty ? (
            <>
              <span className="muted small">Unsaved changes</span>
              <button type="button" className="btn btn-ghost" onClick={discard}>Discard</button>
              <button type="button" className="btn btn-primary" onClick={save}>Save</button>
            </>
          ) : (
            <span className="form-ok">Saved. Rows without a title or time were skipped.</span>
          )}
        </div>
      )}
    </div>
  );
}
