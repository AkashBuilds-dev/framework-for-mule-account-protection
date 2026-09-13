import React, { useEffect, useMemo, useState } from 'react';
import { Download, ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../api/client';
import { createRoleWsManager } from '../api/websocket';
import FieldTopBar from '../components/Field/FieldTopBar';
import FieldAlertFeed from '../components/Field/FieldAlertFeed';
import FieldMap from '../components/Field/FieldMap';
import FieldActionPanel from '../components/Field/FieldActionPanel';
import BottomNav from '../components/Field/BottomNav';
import OnSiteEvidenceModal from '../components/Field/OnSiteEvidenceModal';

const DEFAULT_OFFICER = 'OFF-4471';
const defaultOfficer = {
  id: 'OFF_001',
  officer_id: DEFAULT_OFFICER,
  name: 'Officer Sharma',
  badge_id: '4471',
  badge_number: '4471',
  terminal_id: 'MST-F-4471',
  city: 'Gurugram',
  lat: 28.4595,
  lon: 77.0266,
};

export default function FieldApp() {
  const [officerId, setOfficerId] = useState(() => localStorage.getItem('mst-field-officer') || DEFAULT_OFFICER);
  const [officer, setOfficer] = useState(defaultOfficer);
  const [dispatches, setDispatches] = useState([]);
  const [history, setHistory] = useState({ reports: [], dispatches: [] });
  const [activeDispatch, setActiveDispatch] = useState(null);
  const [tab, setTab] = useState('alerts');
  const [online, setOnline] = useState(navigator.onLine);
  const [booting, setBooting] = useState(() => !sessionStorage.getItem('mst-terminal-booted'));
  const [reportDispatch, setReportDispatch] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [now, setNow] = useState(Date.now());

  const loadFieldData = async (silent = false) => {
    try {
      const [profile, active, past] = await Promise.all([api.getFieldOfficer(officerId), api.getFieldDispatches(officerId), api.getFieldHistory(officerId)]);
      // The field terminal must remain usable if a partially populated officer
      // record arrives from a LAN node or cached response.
      setOfficer({ ...defaultOfficer, ...(profile || {}),
        name: profile?.name || defaultOfficer.name,
        badge_id: profile?.badge_id || profile?.badge_number || defaultOfficer.badge_id,
        badge_number: profile?.badge_number || profile?.badge_id || defaultOfficer.badge_number,
        terminal_id: profile?.terminal_id || defaultOfficer.terminal_id,
        city: profile?.city || defaultOfficer.city,
      });
      setDispatches(active || []); setHistory(past || { reports: [], dispatches: [] });
      if (!activeDispatch && active?.[0]) setActiveDispatch(active[0]);
      navigator.serviceWorker?.controller?.postMessage({ type: 'CACHE_ALERTS', alerts: active || [] });
    } catch (error) { setOnline(false); if (!silent) toast.error('Field terminal could not synchronize with HQ. Cached data remains available.'); }
  };

  useEffect(() => { loadFieldData(); localStorage.setItem('mst-field-officer', officerId); }, [officerId]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const onlineHandler = () => { setOnline(true); loadFieldData(true); };
    const offlineHandler = () => setOnline(false);
    window.addEventListener('online', onlineHandler); window.addEventListener('offline', offlineHandler);
    const installHandler = event => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener('beforeinstallprompt', installHandler);
    return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler); window.removeEventListener('beforeinstallprompt', installHandler); };
  }, [officerId]);
  useEffect(() => { if (booting) { const timer = setTimeout(() => { sessionStorage.setItem('mst-terminal-booted', '1'); setBooting(false); }, 1800); return () => clearTimeout(timer); } }, [booting]);
  useEffect(() => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); }, []);
  useEffect(() => {
    if (window.innerWidth > 500) {
      toast('📱 Field Terminal is optimized for mobile. Best viewed at 375px width.', { id: 'field-mobile-guidance', duration: 6000 });
    }
  }, []);
  useEffect(() => {
    const ws = createRoleWsManager('field');
    const unlisten = ws.subscribe(message => {
      const payload = message.payload || {};
      if (message.channel === 'FIELD_DISPATCH' && payload.officer_id === officerId) {
        setDispatches(current => [payload, ...current.filter(item => item.dispatch_id !== payload.dispatch_id)]);
        setActiveDispatch(current => current || payload);
        toast.success(`CRITICAL dispatch received: ${payload.city}`, { icon: '🚨' });
        if ('Notification' in window && Notification.permission === 'granted') new Notification('🚨 I4C CRITICAL ALERT', { body: `₹${Number(payload.amount || 0).toLocaleString('en-IN')} at risk in ${payload.city}. Dispatch ID: ${payload.dispatch_id}`, icon: '/field-shield.svg', tag: 'critical-alert' });
      }
      if (message.channel === 'FIELD_DISPATCH_UPDATE' && payload.officer_id === officerId) {
        setDispatches(current => payload.status === 'COMPLETED' || payload.status === 'DEFERRED' ? current.filter(item => item.dispatch_id !== payload.dispatch_id) : current.map(item => item.dispatch_id === payload.dispatch_id ? payload : item));
        setActiveDispatch(current => current?.dispatch_id === payload.dispatch_id ? payload : current);
      }
      if (message.channel === 'NEW_ALERT' && payload.severity === 'CRITICAL' && Notification.permission === 'granted') new Notification('🚨 I4C CRITICAL ALERT', { body: `₹${Number(payload.amount || 0).toLocaleString('en-IN')} at risk. Field dispatch initializing.`, icon: '/field-shield.svg', tag: 'critical-alert' });
    });
    ws.connect('field'); return () => { unlisten(); ws.disconnect(); };
  }, [officerId]);

  const accept = async item => { try { const updated = await api.acceptFieldDispatch(item.dispatch_id); setDispatches(current => current.map(d => d.dispatch_id === updated.dispatch_id ? updated : d)); setActiveDispatch(updated); toast.success('Dispatch accepted. Navigate to the ATM hotspot.'); } catch (error) { toast.error(error.message); } };
  const defer = async item => { const reason = window.prompt('Reason for deferral:', 'Assigned to another field unit'); if (!reason) return; try { await api.deferFieldDispatch(item.dispatch_id, reason); setDispatches(current => current.filter(d => d.dispatch_id !== item.dispatch_id)); if (activeDispatch?.dispatch_id === item.dispatch_id) setActiveDispatch(null); toast('Dispatch deferred and logged.'); } catch (error) { toast.error(error.message); } };
  const navigate = item => { setActiveDispatch(item); setTab('map'); };
  const arrived = async item => { try { const updated = await api.arriveAtDispatch(item.dispatch_id); setActiveDispatch(updated); setDispatches(current => current.map(d => d.dispatch_id === updated.dispatch_id ? updated : d)); setTab('actions'); toast.success('On-site status transmitted to HQ.'); } catch (error) { toast.error(error.message); } };
  const submitReport = async details => { try { const result = await api.submitFieldReport({ dispatch_id: reportDispatch.dispatch_id, ...details }); setReportDispatch(null); setDispatches(current => current.filter(item => item.dispatch_id !== reportDispatch.dispatch_id)); setHistory(current => ({ ...current, reports: [result.report, ...current.reports] })); setActiveDispatch(null); setTab('history'); toast.success(`Report ${result.report.report_id} securely submitted.`); } catch (error) { toast.error(error.message); } };
  const resolvedHistory = useMemo(() => [...(history.reports || []), ...(history.dispatches || []).filter(d => d.status === 'DEFERRED')], [history]);

  if (booting) return <div className="min-h-screen grid place-items-center bg-[#0A0E1A] text-center px-8"><div className="space-y-4 animate-pulse"><ShieldAlert className="w-12 h-12 mx-auto text-cyan-400" /><h1 className="font-mono text-cyan-300 text-base tracking-wider">I4C CYBERCRIME FIELD TERMINAL v1.0</h1><p className="font-mono text-xs text-slate-500">Authorized use only. All activity monitored.</p></div></div>;
  return <div className="min-h-screen max-w-lg mx-auto bg-[#0A0E1A] text-[#F1F5F9] font-sans">
    <FieldTopBar officer={officer} unread={dispatches.length} onSelectOfficer={setOfficerId} online={online} />
    {!online && <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2 text-xs font-mono">OFFLINE MODE — Last synchronized alerts retained on this terminal.</div>}
    <main className="p-4 pb-3 min-h-[calc(100vh-130px)]">
      <div className="flex items-center justify-between mb-4"><div><h1 className="text-lg font-bold">{tab === 'alerts' ? 'Live Dispatches' : tab === 'map' ? 'Map & Navigation' : tab === 'actions' ? 'On-Site Actions' : 'My Response History'}</h1><p className="text-xs text-slate-500">I4C Field Response Terminal</p></div>{installPrompt && <button onClick={() => { installPrompt.prompt(); setInstallPrompt(null); }} className="min-h-11 px-3 rounded-lg border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-1"><Download className="w-4 h-4" />Install</button>}</div>
      {tab === 'alerts' && <FieldAlertFeed dispatches={dispatches} now={now} onNavigate={navigate} onAccept={accept} onDefer={defer} />}
      {tab === 'map' && <FieldMap key={activeDispatch?.dispatch_id || 'empty'} dispatch={activeDispatch} officer={officer} onArrived={arrived} />}
      {tab === 'actions' && <FieldActionPanel dispatch={activeDispatch?.status === 'ON_SITE' ? activeDispatch : null} onOpenReport={setReportDispatch} />}
      {tab === 'history' && <div className="space-y-3">{resolvedHistory.map(item => <article key={item.report_id || item.dispatch_id} className="rounded-xl bg-[#111827] border border-slate-800 p-4"><div className="flex justify-between"><span className="text-sm text-white font-semibold">{item.case_id}</span><span className="text-[10px] font-mono text-emerald-300">{item.outcome || item.status}</span></div><p className="mt-1 text-xs text-slate-400">{item.created_at || item.completed_at || item.deferred_at}</p><p className="mt-1 text-xs text-slate-500">{item.notes || item.deferred_reason || 'Field response logged.'}</p></article>)}{!resolvedHistory.length && <div className="py-16 text-center text-slate-500 text-sm">No completed responses in the last 30 days.</div>}</div>}
    </main>
    <BottomNav active={tab} setActive={setTab} alertCount={dispatches.length} />
    <OnSiteEvidenceModal dispatch={reportDispatch} onClose={() => setReportDispatch(null)} onSubmit={submitReport} />
  </div>;
}
