/**
 * ==============================================================================
 * MuleShield (SIH26184) - Top Bar Navigation & Command Header
 * ==============================================================================
 * - 64px fixed command header
 * - Live WebSocket status indicator (🟢 Live / 🟡 Reconnecting / 🔴 Offline)
 * - ADDITION 4: "▶ Simulate Fraud" button (accent cyan #06B6D4)
 * - Live digital IST clock, HQ IP address, and Investigator badge
 * ==============================================================================
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Shield,
  Play,
  Activity,
  Clock,
  Wifi,
  WifiOff,
  AlertTriangle,
  Building2,
  Sliders,
  ChevronDown,
  LayoutGrid,
  Smartphone,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { simulateLiveFraud, simulateCriticalAlert } from '../api/client';
import { toast } from 'react-hot-toast';

export default function TopBar({ roleBadge, roleColor, connectionHost }) {
  const { wsStatus, lastSync, apiError } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [istTime, setIstTime] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSimulatingCritical, setIsSimulatingCritical] = useState(false);
  const [syncElapsed, setSyncElapsed] = useState('just now');
  const [isPortalDropdownOpen, setIsPortalDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsPortalDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Live IST Digital Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      };
      setIstTime(new Intl.DateTimeFormat('en-GB', options).format(now));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Last Sync Elapsed Counter
  useEffect(() => {
    const updateElapsed = () => {
      if (!lastSync) return;
      const seconds = Math.floor((new Date() - new Date(lastSync)) / 1000);
      if (seconds < 5) setSyncElapsed('just now');
      else if (seconds < 60) setSyncElapsed(`${seconds}s ago`);
      else setSyncElapsed(`${Math.floor(seconds / 60)}m ago`);
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 2000);
    return () => clearInterval(timer);
  }, [lastSync]);

  // ADDITION 4: Live Fraud Simulation Trigger
  const handleSimulateFraud = async () => {
    if (isSimulating) return;
    setIsSimulating(true);

    try {
      toast.loading('Generating simulated fraud complaint...', { id: 'sim' });
      const newCase = await simulateLiveFraud();
      toast.success(
        `Live Fraud Simulated: ₹${newCase.victim_info.amount_lost?.toLocaleString('en-IN')} scammed in ${newCase.victim_info.city}!`,
        { id: 'sim', duration: 4000 }
      );
    } catch (err) {
      console.error('Simulation error:', err);
      toast.error(`Simulation failed: ${err.message}`, { id: 'sim' });
    } finally {
      setIsSimulating(false);
    }
  };

  // MODULE H ADDITION: Live CRITICAL Escalation Simulation Trigger
  const handleSimulateCritical = async () => {
    if (isSimulatingCritical) return;
    setIsSimulatingCritical(true);

    try {
      toast.loading('Initiating 4-Tier Critical Escalation Protocol...', { id: 'crit-sim' });
      const res = await simulateCriticalAlert();
      toast.success(
        `🚨 CRITICAL ESCALATION TRIGGERED! ₹75,000 Case ${res.case?.case_id || ''} | Auto-Freeze Requested | SLA 5m Countdown Started`,
        { id: 'crit-sim', duration: 5000, icon: '🚨' }
      );
    } catch (err) {
      console.error('Critical simulation error:', err);
      toast.error(`Critical escalation failed: ${err.message}`, { id: 'crit-sim' });
    } finally {
      setIsSimulatingCritical(false);
    }
  };


  const currentHost = connectionHost || (typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost');

  // Determine current portal metadata
  const path = location.pathname;
  let activePortalName = 'Investigator';
  let activeRoleBadge = roleBadge || 'INVESTIGATOR';
  let badgeStyle = 'bg-blue-500/10 border-blue-500/30 text-blue-400';

  if (path === '/bank' || roleBadge === 'BANK OFFICER') {
    activePortalName = 'Bank Officer';
    activeRoleBadge = 'BANK OFFICER';
    badgeStyle = 'bg-blue-500/15 border-blue-500/40 text-blue-400';
  } else if (path === '/admin' || roleBadge?.includes('ADMIN')) {
    activePortalName = 'Admin Console';
    activeRoleBadge = 'ADMIN — I4C HQ';
    badgeStyle = 'bg-purple-500/15 border-purple-500/40 text-purple-300';
  } else if (path === '/field') {
    activePortalName = 'Field Officer';
    activeRoleBadge = 'FIELD TERMINAL';
    badgeStyle = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
  }

  return (
    <header className="h-16 border-b border-border-subtle bg-[#0D1322] px-5 flex items-center justify-between z-30 sticky top-0 backdrop-blur-md">
      {/* Left: Brand & SIH Badge */}
      <div className="flex items-center space-x-3.5">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-glow-cyan">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-semibold tracking-tight text-white text-base">MuleShield</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-semibold tracking-wider uppercase">
              SIH26184
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono tracking-tight">I4C Cybercrime Intelligence Hub</p>
        </div>
      </div>

      {/* Center: Real-Time Connection Telemetry & HQ Alert Banner */}
      <div className="flex items-center space-x-4">
        {/* Graceful Reconnecting Banner if API or WS down */}
        {apiError || wsStatus !== 'connected' ? (
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>⚠ Reconnecting to HQ ({currentHost}:8000)...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-300 font-medium tracking-wide">Live</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400 font-mono text-[11px]">Sync: {syncElapsed}</span>
          </div>
        )}
      </div>

      {/* Right: Portal Switch, Simulate Button, HQ IP, IST Clock & Officer Badge */}
      <div className="flex items-center space-x-3">
        {/* INSTRUCTION 2: Portal Switcher Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            id="portal-switch-dropdown-btn"
            onClick={() => setIsPortalDropdownOpen(!isPortalDropdownOpen)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1A2234] border border-border-subtle hover:border-cyan-500/50 text-slate-200 hover:text-cyan-300 text-xs font-medium transition cursor-pointer shadow-sm"
            title="Switch portal interface for live multi-laptop demo"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">Switch Portal</span>
            <span className="text-slate-400 text-[11px] hidden lg:inline">({activePortalName})</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isPortalDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isPortalDropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-[#0F172A] border border-border-subtle rounded-xl shadow-2xl py-1.5 z-50 backdrop-blur-xl">
              <div className="px-3 py-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider border-b border-border-subtle">
                Switch Operational Console
              </div>
              <button
                id="switch-to-investigator-btn"
                onClick={() => {
                  navigate('/');
                  setIsPortalDropdownOpen(false);
                }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 text-xs transition cursor-pointer hover:bg-cyan-500/10 ${
                  path === '/' ? 'bg-cyan-500/15 text-cyan-300 font-semibold border-l-2 border-cyan-400' : 'text-slate-300'
                }`}
              >
                <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="text-left">
                  <div className="text-white font-medium">Investigator (/)</div>
                  <div className="text-[10px] text-slate-400 font-mono">Flagship 3D GIS & Entity Resolution</div>
                </div>
              </button>
              <button
                id="switch-to-bank-btn"
                onClick={() => {
                  navigate('/bank');
                  setIsPortalDropdownOpen(false);
                }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 text-xs transition cursor-pointer hover:bg-blue-500/10 ${
                  path === '/bank' ? 'bg-blue-500/15 text-blue-300 font-semibold border-l-2 border-blue-400' : 'text-slate-300'
                }`}
              >
                <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="text-left">
                  <div className="text-white font-medium">Bank Officer (/bank)</div>
                  <div className="text-[10px] text-slate-400 font-mono">Section 102 CrPC Debit Freeze Queue</div>
                </div>
              </button>
              <button
                id="switch-to-admin-btn"
                onClick={() => {
                  navigate('/admin');
                  setIsPortalDropdownOpen(false);
                }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 text-xs transition cursor-pointer hover:bg-purple-500/10 ${
                  path === '/admin' ? 'bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-purple-400' : 'text-slate-300'
                }`}
              >
                <Sliders className="w-4 h-4 text-purple-400 shrink-0" />
                <div className="text-left">
                  <div className="text-white font-medium">Admin Console (/admin)</div>
                  <div className="text-[10px] text-slate-400 font-mono">I4C HQ ML Ops & Audit Trail</div>
                </div>
              </button>
              <button
                id="switch-to-field-btn"
                onClick={() => {
                  navigate('/field');
                  setIsPortalDropdownOpen(false);
                }}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 text-xs transition cursor-pointer hover:bg-emerald-500/10 ${
                  path === '/field' ? 'bg-emerald-500/15 text-emerald-300 font-semibold border-l-2 border-emerald-400' : 'text-slate-300'
                }`}
              >
                <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="text-left">
                  <div className="text-white font-medium">Field Officer (PWA) (/field)</div>
                  <div className="text-[10px] text-slate-400 font-mono">I4C mobile dispatch & on-site evidence terminal</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Simulate Live Fraud Button */}
        <button
          id="simulate-fraud-btn"
          onClick={handleSimulateFraud}
          disabled={isSimulating}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-white text-xs font-semibold tracking-wide transition shadow-lg shadow-cyan-500/25 active:scale-95 disabled:opacity-50 cursor-pointer"
          title="Dispatch randomized cybercrime complaint to demonstrate real-time alert reaction across LAN laptops"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isSimulating ? 'animate-spin' : ''}`} />
          <span>{isSimulating ? 'Generating...' : '▶ Simulate Fraud'}</span>
        </button>

        {/* MODULE H ADDITION: Live CRITICAL Escalation Simulation Button */}
        <button
          id="simulate-critical-btn"
          onClick={handleSimulateCritical}
          disabled={isSimulatingCritical}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold tracking-wide transition shadow-lg shadow-red-500/30 active:scale-95 disabled:opacity-50 cursor-pointer animate-pulse"
          title="Simulate CRITICAL Threat: auto-freeze request, SMS to ACP/Nodal Bank, automated call, field interceptor dispatch, 5-minute SLA timer"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-200" />
          <span>{isSimulatingCritical ? 'Escalating...' : '⚠ Simulate CRITICAL Alert'}</span>
        </button>


        {/* HQ IP Indicator */}
        <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#111827] border border-border-subtle text-[11px] font-mono text-slate-300">
          <Activity className="w-3 h-3 text-cyan-400" />
          <span>HQ: {currentHost}:8000</span>
        </div>

        {/* Live IST Clock */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#111827] border border-border-subtle text-[11px] font-mono text-slate-200">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{istTime || '--:--:--'} IST</span>
        </div>

        {/* Role Badge */}
        <div className={`px-2.5 py-1 rounded border text-xs font-semibold tracking-wider uppercase font-mono ${badgeStyle}`}>
          {activeRoleBadge}
        </div>
      </div>
    </header>
  );
}
