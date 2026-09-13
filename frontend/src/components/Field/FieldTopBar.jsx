import React, { useState } from 'react';
import { Bell, ChevronDown, Radio, Shield } from 'lucide-react';

export default function FieldTopBar({ officer, unread, onSelectOfficer, online }) {
  const [open, setOpen] = useState(false);
  const officers = [
    { officer_id: 'OFF-4471', name: 'Officer Sharma', badge_number: '4471', city: 'Gurugram', terminal_id: 'MST-F-4471' },
    { officer_id: 'OFF-5182', name: 'Officer Patel', badge_number: '5182', city: 'Mumbai', terminal_id: 'MST-F-5182' },
    { officer_id: 'OFF-6304', name: 'Officer Reddy', badge_number: '6304', city: 'Bengaluru', terminal_id: 'MST-F-6304' },
  ];
  return <header className="h-14 sticky top-0 z-30 bg-[#0D1322]/95 backdrop-blur border-b border-slate-800 px-3 flex items-center justify-between">
    <div className="relative min-w-0">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-left min-h-11">
        <div className="w-9 h-9 rounded-full bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center"><Shield className="w-4 h-4 text-cyan-300" /></div>
        <div className="min-w-0"><div className="text-xs font-semibold text-white truncate">{officer?.name || 'Field Officer'} <ChevronDown className="inline w-3 h-3" /></div><div className="text-[9px] font-mono text-slate-500">TERMINAL: {officer?.terminal_id || 'MST-F-4471'}</div></div>
      </button>
      {open && <div className="absolute top-12 left-0 w-60 p-1 rounded-xl border border-slate-700 bg-[#111827] shadow-2xl">{officers.map(item => <button key={item.officer_id} onClick={() => { onSelectOfficer(item.officer_id); setOpen(false); }} className="w-full text-left px-3 py-3 rounded-lg hover:bg-cyan-500/10 min-h-11"><div className="text-xs text-white">{item.name} <span className="text-slate-500">#{item.badge_number}</span></div><div className="text-[10px] text-slate-500">Demo mode • {item.city}</div></button>)}</div>}
    </div>
    <div className={`flex items-center gap-1 text-[10px] font-mono ${online ? 'text-emerald-300' : 'text-amber-300'}`}><Radio className="w-3 h-3" />{online ? 'LIVE' : 'OFFLINE'}</div>
    <div className="relative p-2"><Bell className="w-5 h-5 text-slate-200" />{unread > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] min-w-4 h-4 rounded-full grid place-items-center">{unread}</span>}</div>
  </header>;
}
