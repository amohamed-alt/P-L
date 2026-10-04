import { useEffect, useRef, useState } from 'react';
import { App } from './App';
import './styles-activity.css';

async function api(path, body) {
  const response = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) { const error = new Error(payload.error || 'Request failed'); error.status = response.status; throw error; }
  return payload;
}
const currentView = () => location.hash.includes('forecast') ? 'forecast' : 'actual';
const duration = seconds => seconds < 60 ? `${Math.floor(seconds)}s` : `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
const date = value => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function Tracker() {
  useEffect(() => {
    let cancelled = false, visitId, timer, interaction = Date.now(), lastTick = Date.now(), interrupted = false;
    const touch = () => { interaction = Date.now(); };
    const interrupt = () => { interrupted = true; };
    window.addEventListener('blur', interrupt);
    document.addEventListener('visibilitychange', interrupt);
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, touch, { passive: true }));
    const start = async () => {
      try {
        const visit = await api('/api/activity/visit', { view: currentView() });
        if (cancelled) return;
        visitId = visit.visitId;
        timer = setInterval(async () => {
          const now = Date.now();
          const active = !interrupted && document.visibilityState === 'visible' && document.hasFocus() && now - interaction < 60000 && now - lastTick < 30000;
          lastTick = now; interrupted = document.visibilityState !== 'visible' || !document.hasFocus();
          try { await api('/api/activity/heartbeat', { visitId, active, view: currentView() }); } catch {}
        }, 15000);
      } catch {}
    };
    // Deferred start prevents duplicate visits during React StrictMode effect replay.
    const initial = setTimeout(start, 0);
    return () => { cancelled = true; clearTimeout(initial); clearInterval(timer); window.removeEventListener('blur', interrupt); document.removeEventListener('visibilitychange', interrupt); events.forEach(event => window.removeEventListener(event, touch)); };
  }, []);
  return null;
}

export function ViewerAccess() {
  const [name, setName] = useState(null), [entry, setEntry] = useState(''), [ready, setReady] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api('/api/viewer').then(v => { setName(v.name); setReady(true); }).catch(() => { setError('Could not connect. Please reload.'); setReady(true); }); }, []);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await api('/api/viewer', { name: entry }); setName(result.name); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (!ready) return <div className="access-page"><p>Loading dashboard…</p></div>;
  if (!name) return <div className="access-page"><form className="access-card" onSubmit={submit}><img src="/talentera-logo.svg" alt="Talentera" /><span className="activity-eyebrow">TECH LICENSING · P&L</span><h1>Welcome to the dashboard</h1><p>Enter your name to continue.</p><label htmlFor="viewer-name">Your name</label><input id="viewer-name" autoComplete="name" required minLength={2} maxLength={80} value={entry} onChange={e => setEntry(e.target.value)} placeholder="Full name" /><small>Visits and active viewing time are recorded.</small>{error && <p role="alert" className="activity-error">{error}</p>}<button disabled={busy}>{busy ? 'Opening…' : 'Open dashboard'}</button></form></div>;
  return <><Tracker /><div className="viewer-badge"><span>{name}</span><button onClick={() => { setEntry(name); setName(null); }}>Change name</button></div><App /></>;
}

export function TeamActivity() {
  const [report, setReport] = useState(null), [password, setPassword] = useState(''), [signedIn, setSignedIn] = useState(false), [days, setDays] = useState(30), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const generation = useRef(0);
  async function refresh() {
    const current = ++generation.current;
    try { const data = await api(`/api/admin/activity?days=${days}`); if (current === generation.current) { setReport(data); setSignedIn(true); setError(''); } }
    catch (e) { if (current === generation.current) { if (e.status === 401) { setSignedIn(false); setReport(null); } else setError(e.message); } }
  }
  useEffect(() => { refresh(); const timer = setInterval(refresh, 30000); return () => { clearInterval(timer); generation.current++; }; }, [days]);
  async function login(event) { event.preventDefault(); setBusy(true); setError(''); try { await api('/api/admin/login', { password }); setPassword(''); await refresh(); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  if (!signedIn) return <div className="access-page"><form className="access-card" onSubmit={login}><span className="activity-eyebrow">PRIVATE ADMIN ACCESS</span><h1>Team Activity</h1><p>Enter your admin password to view this report.</p><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />{error && <p className="activity-error" role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button><a href="/">Back to dashboard</a></form></div>;
  return <div className="activity-page"><header className="activity-header"><div><span className="activity-eyebrow">PRIVATE · ADMIN ONLY</span><h1>Team Activity</h1><p>Who visits the dashboard and how long they actively view it.</p></div><div className="activity-actions"><a href="/">Dashboard</a><button onClick={async () => { await api('/api/admin/logout', {}); setSignedIn(false); setReport(null); }}>Sign out</button></div></header><div className="activity-toolbar"><label>Period <select value={days} onChange={e => setDays(Number(e.target.value))}><option value={1}>Last 24 hours</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label><button onClick={refresh}>Refresh</button><span>Updates every 30 seconds</span></div>{error && <p role="alert" className="activity-error">{error}</p>}{report && <><div className="activity-stats">{[['People', report.people.length], ['Visits', report.visits], ['Active viewing time', duration(report.activeSeconds)]].map(([title,value]) => <div key={title}><span>{title}</span><strong>{value}</strong></div>)}</div><section className="activity-table"><h2>Viewer activity</h2>{!report.people.length ? <p>No visits recorded in this period yet.</p> : <div className="activity-table-scroll"><table><thead><tr><th>Name</th><th>Visits</th><th>Active time</th><th>First visit</th><th>Last seen</th><th>Last view</th></tr></thead><tbody>{report.people.map(person => <tr key={person.name}><td><strong>{person.name}</strong>{Date.now()-person.lastSeen < 45000 && <span className="activity-live">Recent</span>}</td><td>{person.visits}</td><td>{duration(person.activeSeconds)}</td><td>{date(person.firstSeen)}</td><td>{date(person.lastSeen)}</td><td>{person.view}</td></tr>)}</tbody></table></div>}</section><p className="activity-note">Names are entered by visitors and are not verified identities. Active time counts foreground viewing with recent interaction; idle tabs are excluded. Records are retained for 90 days. Times use your browser’s timezone.</p></>}</div>;
}
