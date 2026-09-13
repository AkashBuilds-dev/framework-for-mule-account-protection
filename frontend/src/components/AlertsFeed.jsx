/**
 * ==============================================================================
 * MuleShield (SIH26184) - Live Alerts Feed Component (Row 3 Right - 40%)
 * ==============================================================================
 * Real-time event queue driven by WebSocket broadcaster:
 * - Slide-in animations on incoming alerts
 * - Severity badges with pulsing radar indicator for CRITICAL alerts
 * - Direct "Acknowledge", "Dispatch", and "View Case" actions
 * - ADDITION 5: Skeleton shimmer on load
 * - ADDITION 6: Professional empty state ("No alerts. All clear.")
 * ==============================================================================
 */

import React, { useEffect, useState } from 'react';
import { Bell, Check, ExternalLink, ShieldAlert, BellOff, Car, Clock } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { toast } from 'react-hot-toast';

export default function AlertsFeed({ onViewCase }) {
  const { alerts, loading, acknowledgeAlert, selectCase } = useAppStore();
  const [ackLoading, setAckLoading] = useState({});
  const [nowTs, setNowTs] = useState(Date.now());

  // 1-second interval for live SLA ticking countdowns
  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAck = async (alertId) => {
    setAckLoading((prev) => ({ ...prev, [alertId]: true }));
    try {
      await acknowledgeAlert(alertId, 'Acknowledged by Investigator Console.');
    } finally {
      setAckLoading((prev) => ({ ...prev, [alertId]: false }));
    }
  };

  const handleViewCase = (caseId) => {
    if (caseId) {
      selectCase(caseId);
      if (onViewCase) onViewCase(caseId);
    } else {
      toast('Alert not linked to a specific case file.', { icon: 'ℹ️' });
    }
  };

  const handleDispatchField = (alert) => {
    toast.success(`Field Interceptor dispatched for Account ${alert.account_id}!`, {
      icon: '🚔',
      style: { background: '#111827', color: '#F1F5F9', border: '1px solid #06B6D4' },
    });
  };

  // Format seconds to mm:ss or hh:mm:ss
  const formatSlaCountdown = (seconds) => {
    if (seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ADDITION 5: Skeleton Loader
  if (loading.alerts) {
    return (
      <div className="bg-[#111827] border border-border-subtle rounded-xl p-5 shadow-card h-[450px] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="h-4 w-36 bg-slate-800 rounded animate-pulse"></div>
          <div className="h-4 w-16 bg-slate-800 rounded animate-pulse"></div>
        </div>
        <div className="space-y-3 mt-4 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-800/50 rounded-lg animate-pulse border border-slate-800"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] border border-border-subtle rounded-xl p-5 shadow-card flex flex-col h-[450px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-border-subtle shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Live Alerts Feed</h3>
            <p className="text-[11px] text-slate-400 font-mono">Real-time Threat Intercepts & SLA Matrix</p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 font-semibold">
          {alerts.length} Active
        </span>
      </div>

      {/* Alert Stream / ADDITION 6: Empty State */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mt-3.5">
        {!alerts || alerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
            <BellOff className="w-9 h-9 text-slate-500 stroke-[1.5]" />
            <p className="text-sm font-medium text-[#94A3B8]">No alerts. All clear.</p>
            <p className="text-xs text-slate-600 font-mono max-w-xs">
              System monitoring live transaction flows. High-risk escalations will stream here automatically.
            </p>
          </div>
        ) : (
          alerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';

            // SLA Calculation
            const totalSlaSec = alert.sla_seconds || alert.escalation?.sla_seconds || (isCritical ? 300 : alert.severity === 'HIGH' ? 900 : 3600);
            let remSec = totalSlaSec;
            const deadlineStr = alert.sla_deadline || alert.escalation?.sla_deadline;

            if (deadlineStr) {
              const deadlineMs = new Date(deadlineStr.replace(' ', 'T')).getTime();
              remSec = Math.max(0, Math.floor((deadlineMs - nowTs) / 1000));
            }

            const pctRemaining = (remSec / totalSlaSec) * 100;
            const isBreached = remSec <= 0 && alert.status !== 'RESOLVED' && alert.status !== 'ACKNOWLEDGED';
            const isUrgentCritical = isCritical && remSec < 120 && !isBreached;

            // SLA Badge styling
            let slaBadgeClass = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400';
            if (isBreached) {
              slaBadgeClass = 'bg-red-600 text-white font-bold border-red-500';
            } else if (pctRemaining < 25 || isUrgentCritical) {
              slaBadgeClass = 'bg-red-500/15 border-red-500/60 text-red-400 animate-pulse';
            } else if (pctRemaining <= 50) {
              slaBadgeClass = 'bg-amber-500/15 border-amber-500/40 text-amber-300';
            }

            // Card border styling
            let cardBorder = 'border-amber-500/30';
            if (isUrgentCritical) {
              cardBorder = 'border-2 border-red-500 animate-pulse shadow-glow-danger';
            } else if (isCritical) {
              cardBorder = 'border-red-500/50 shadow-glow-danger/20';
            }

            return (
              <div
                key={alert.alert_id}
                className={`p-3.5 rounded-lg bg-[#0E1526] transition duration-150 relative border ${cardBorder}`}
              >
                {/* Top Row: Severity, SLA Countdown & Timestamps */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="flex h-2 w-2 relative">
                      {isCritical && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-2 w-2 ${
                          isCritical ? 'bg-red-500' : 'bg-amber-500'
                        }`}
                      ></span>
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        isCritical
                          ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-300">
                      {alert.alert_id}
                    </span>
                  </div>

                  {/* SLA Countdown Badge */}
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center space-x-1 ${slaBadgeClass}`}
                      title={`SLA Target: ${totalSlaSec}s`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      <span>
                        {isBreached
                          ? 'BREACHED'
                          : alert.status === 'ACKNOWLEDGED' || alert.status === 'RESOLVED'
                          ? 'HALTED'
                          : `${formatSlaCountdown(remSec)} SLA`}
                      </span>
                    </span>

                    <span className="text-[11px] font-mono text-slate-400">
                      {alert.created_at ? alert.created_at.slice(11, 19) : 'Just now'}
                    </span>
                  </div>
                </div>

                {/* Amount & Account Target */}
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <p className="text-sm font-bold text-white font-mono">
                      ₹{alert.amount?.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[11px] font-mono text-cyan-400 mt-0.5">
                      Account: {alert.account_id}
                    </p>
                  </div>
                  {alert.case_id && (
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {alert.case_id}
                    </span>
                  )}
                </div>

                {/* Escalation Action Plan */}
                {alert.escalation?.action_plan && (
                  <p className="text-[11px] text-slate-400 mt-2 bg-[#0A0E1A] p-2 rounded border border-slate-800/80 leading-relaxed font-sans">
                    {alert.escalation.action_plan}
                  </p>
                )}


                {/* Action Buttons */}
                <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-end space-x-2">
                  {/* Acknowledge Action */}
                  <button
                    onClick={() => handleAck(alert.alert_id)}
                    disabled={ackLoading[alert.alert_id]}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1 border border-slate-700 transition cursor-pointer"
                    title="Acknowledge alert and halt escalation timer"
                  >
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>{ackLoading[alert.alert_id] ? 'Acking...' : 'Acknowledge'}</span>
                  </button>

                  {/* Dispatch Field Interceptor */}
                  <button
                    onClick={() => handleDispatchField(alert)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-200 text-xs font-medium flex items-center space-x-1 border border-slate-700 transition cursor-pointer"
                    title="Alert Mobile Patrol Vehicle"
                  >
                    <Car className="w-3 h-3 text-cyan-400" />
                    <span>Dispatch</span>
                  </button>

                  {/* View Full Case Dossier */}
                  {alert.case_id && (
                    <button
                      onClick={() => handleViewCase(alert.case_id)}
                      className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center space-x-1 transition cursor-pointer"
                      title="Inspect complete case evidence and mule network"
                    >
                      <span>View Case</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
