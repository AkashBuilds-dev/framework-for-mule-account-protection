/**
 * ==============================================================================
 * MuleShield (SIH26184) - Sidebar Navigation Component
 * ==============================================================================
 * 260px navigation drawer providing rapid forensic routing and system telemetry.
 * ==============================================================================
 */

import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Bell,
  Share2,
  FileText,
  Settings,
  Users,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { stats } = useAppStore();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'cases', label: 'Cases Docket', icon: FolderKanban, badge: stats.total_cases },
    { id: 'alerts', label: 'Live Alerts', icon: Bell, badge: stats.active_alerts, badgeColor: 'bg-red-500/20 text-red-400 border border-red-500/30' },
    { id: 'graph', label: 'Network Graph', icon: Share2, badge: '5 Rings' },
    { id: 'audit', label: 'Audit Trail', icon: FileText, badge: null },
    { id: 'settings', label: 'System Config', icon: Settings, badge: null },
  ];

  return (
    <aside className="w-64 border-r border-border-subtle bg-[#0A0E1A] flex flex-col justify-between shrink-0 select-none">
      {/* Navigation Links */}
      <div className="p-4 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
          Forensic Operations
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition duration-150 ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:bg-[#111827] hover:text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge !== null && item.badge !== undefined && (
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                    item.badgeColor || 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* System Telemetry Footnote */}
      <div className="p-4 border-t border-border-subtle bg-[#0D1322]/80 space-y-3">
        {/* Connected Clients Counter */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-400">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>Connected Laptops</span>
          </div>
          <span className="font-mono font-semibold text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]">
            {stats.connected_clients || 1}
          </span>
        </div>

        {/* Distributed Hub Status */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>MuleShield Hub</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 font-medium">v1.0 Ready</span>
        </div>
      </div>
    </aside>
  );
}
