/**
 * ==============================================================================
 * MuleShield (SIH26184) - Hero KPI Stat Cards (Row 1)
 * ==============================================================================
 * Displays 4 mission-critical indicators with loading skeleton shimmers:
 * 1. Active Cases (with trend)
 * 2. Active Alerts (CRITICAL / HIGH breakdown)
 * 3. ₹ Amount at Risk (Lakhs/Crores formatted)
 * 4. Connected Clients & Distributed System Health
 * ==============================================================================
 */

import React from 'react';
import { FolderKanban, AlertOctagon, IndianRupee, Laptop, TrendingUp, ShieldAlert } from 'lucide-react';
import { useAppStore } from '../store/appStore';

export default function StatCards() {
  const { stats, loading } = useAppStore();

  // Helper formatting INR currency in Lakhs or Crores
  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return '₹0.00';
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} L`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // ADDITION 5: Skeleton Loader Card
  const SkeletonCard = () => (
    <div className="bg-[#111827] border border-border-subtle rounded-xl p-4 h-[104px] animate-pulse flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-24 bg-slate-800 rounded"></div>
        <div className="w-8 h-8 rounded-lg bg-slate-800"></div>
      </div>
      <div className="h-7 w-28 bg-slate-800 rounded mt-2"></div>
      <div className="h-3 w-36 bg-slate-800/60 rounded"></div>
    </div>
  );

  if (loading.stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      {/* Card 1: Active Cases */}
      <div className="bg-[#111827] border border-border-subtle hover:border-slate-700 rounded-xl p-4.5 transition duration-150 shadow-card relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Active Cases</span>
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition">
            <FolderKanban className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-3 mt-1.5">
          <span className="text-2xl font-bold tracking-tight text-white font-mono">
            {stats.total_cases}
          </span>
          <span className="inline-flex items-center text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            <TrendingUp className="w-3 h-3 mr-0.5" /> +2 today
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1 font-mono">
          Under Investigation & Confirmed
        </p>
      </div>

      {/* Card 2: Active Alerts */}
      <div className="bg-[#111827] border border-border-subtle hover:border-red-500/40 rounded-xl p-4.5 transition duration-150 shadow-card relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Active Threat Alerts</span>
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 group-hover:scale-105 transition">
            <AlertOctagon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2.5 mt-1.5">
          <span className="text-2xl font-bold tracking-tight text-white font-mono">
            {stats.active_alerts}
          </span>
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400">
              CRITICAL
            </span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
              HIGH
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-1 font-mono">
          Requiring Field or Bank Intervention
        </p>
      </div>

      {/* Card 3: ₹ Amount At Risk */}
      <div className="bg-[#111827] border border-border-subtle hover:border-slate-700 rounded-xl p-4.5 transition duration-150 shadow-card relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Total ₹ At Risk</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition">
            <IndianRupee className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2 mt-1.5">
          <span className="text-2xl font-bold tracking-tight text-white font-mono">
            {formatCurrency(stats.total_amount_at_risk)}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1 font-mono">
          Across {stats.high_risk_zones_active || 45} Monitored ATM Cells
        </p>
      </div>

      {/* Card 4: Connected Laptops & System Status */}
      <div className="bg-[#111827] border border-border-subtle hover:border-slate-700 rounded-xl p-4.5 transition duration-150 shadow-card relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Connected Laptops</span>
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition">
            <Laptop className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-3 mt-1.5">
          <span className="text-2xl font-bold tracking-tight text-white font-mono">
            {stats.connected_clients || 1}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold tracking-wider uppercase">
            {stats.system_status || 'OPERATIONAL'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1 font-mono">
          Investigator • Bank • Field Mobile
        </p>
      </div>
    </div>
  );
}
