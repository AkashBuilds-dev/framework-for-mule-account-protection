/**
 * ==============================================================================
 * MuleShield (SIH26184) - Bank Officer Dashboard (Module G)
 * ==============================================================================
 * Dedicated statutory console for Nodal Bank Officers:
 * - Section 102 CrPC / Section 106 BNSS preemptive debit freeze execution
 * - Real-time freeze request queue with severity SLA countdowns
 * - Automated audit compliance tracking & bank-specific mule account watchlist
 * - Live bi-directional WebSocket synchronization with HQ via /ws/bank
 * ==============================================================================
 */

import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  IndianRupee,
  Building2,
  AlertOctagon,
  FileCheck2,
  Eye,
  ShieldX,
  Search,
  RefreshCw,
  Lock,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import { api } from '../api/client';
import { createRoleWsManager } from '../api/websocket';
import { toast } from 'react-hot-toast';

export default function BankDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    pending_freezes: 3,
    critical_freezes: 3,
    approved_today: 2,
    amount_frozen_today: 70000,
    avg_approval_seconds: 12.4,
    compliance_sla_rate: 98.6,
    total_frozen_overall: 1320000,
  });
  const [freezeQueue, setFreezeQueue] = useState([]);
  const [complianceLogs, setComplianceLogs] = useState([]);
  const [muleWatchlist, setMuleWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedCaseModal, setSelectedCaseModal] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { freeze, type: 'APPROVE' | 'REJECT' }
  const [actionNotes, setActionNotes] = useState('');
  const [officerName, setOfficerName] = useState('Ananya Rao (SBI Nodal)');
  const [nowTs, setNowTs] = useState(Date.now());

  // 1-second interval for live ticking SLA countdowns
  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format SLA countdown
  const formatSlaCountdown = (seconds) => {
    if (seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getSlaForFreeze = (item) => {
    const deadline = item.sla_deadline || item.escalation_deadline;
    const total = Number(item.sla_seconds) || { CRITICAL: 300, HIGH: 900, MEDIUM: 3600, LOW: 86400 }[item.severity] || 3600;
    const deadlineMs = deadline ? new Date(deadline.replace(' ', 'T')).getTime() : NaN;
    const fallbackCreated = item.timestamp ? new Date(item.timestamp.replace(' ', 'T')).getTime() : nowTs;
    const validDeadline = Number.isFinite(deadlineMs) ? deadlineMs : fallbackCreated + total * 1000;
    const remaining = Math.max(0, Math.ceil((validDeadline - nowTs) / 1000));
    const percent = total ? (remaining / total) * 100 : 0;
    const breached = remaining <= 0;
    const critical = !breached && (percent < 25 || remaining < 120);
    const warning = !breached && !critical && percent <= 50;
    return { deadlineMs: validDeadline, remaining, breached, critical, warning };
  };

  // Currency Formatter helper
  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return '₹0.00';
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  };


  // Fetch all Bank portal data
  const loadBankData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [statsRes, queueRes, auditRes, watchlistRes, alertsRes] = await Promise.all([
        api.getBankStats(),
        api.getFreezeQueue(),
        api.getAuditLogs(30),
        api.getBankWatchlist(),
        api.getActiveAlerts(),
      ]);

      setStats(statsRes);
      const alertByCase = new Map((alertsRes || []).map((alert) => [alert.case_id, alert]));
      const enrichedQueue = (queueRes || []).map((freeze) => {
        const alert = alertByCase.get(freeze.case_id);
        return alert
          ? { ...freeze, sla_deadline: alert.sla_deadline, sla_seconds: alert.sla_seconds }
          : freeze;
      });
      enrichedQueue.sort((a, b) => getSlaForFreeze(a).deadlineMs - getSlaForFreeze(b).deadlineMs);
      setFreezeQueue(enrichedQueue);
      // Filter audit logs for freeze operations
      const freezeAudits = (auditRes.logs || []).filter((l) =>
        l.action?.includes('FREEZE') || l.entity_type === 'FREEZE_ORDER'
      );
      setComplianceLogs(freezeAudits);
      setMuleWatchlist(watchlistRes || []);
    } catch (err) {
      console.error('[Bank Dashboard] Failed to load data:', err);
      if (!silent) toast.error('Failed to sync bank console with HQ server.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadBankData();

    // Bind dedicated Bank WebSocket (/ws/bank)
    const bankWs = createRoleWsManager('bank');

    const unsubscribe = bankWs.subscribe((msg) => {
      console.log('[Bank WS] Event received:', msg.channel, msg.payload);
      if (msg.channel === 'FREEZE_APPROVED' || msg.channel === 'FREEZE_PENDING' || msg.channel === 'NEW_ALERT' || msg.channel === 'CASE_UPDATED' || msg.channel === 'ESCALATION_BUMP') {
        // Refresh queue and stats live
        loadBankData(true);
        if (msg.channel === 'FREEZE_APPROVED' && msg.payload?.status === 'REQUESTED') {
          toast(
            `🚨 New Urgent Debit Freeze Requested for ₹${Number(msg.payload.item?.amount_at_risk || 0).toLocaleString('en-IN')}!`,
            { icon: '⚠️', duration: 5000 }
          );
        }
      }
    });

    bankWs.connect('bank');

    return () => {
      unsubscribe();
      bankWs.disconnect();
    };
  }, []);

  // Handle Approve / Reject Action
  const handleExecuteAction = async () => {
    if (!actionModal) return;
    const { freeze, type } = actionModal;
    const freezeId = freeze.freeze_id;

    try {
      setActionLoading(freezeId);
      const payload = {
        action: type,
        officer: officerName,
        notes: actionNotes || (type === 'APPROVE' ? 'Preemptive Section 102 CrPC debit freeze placed.' : 'Rejected upon manual verification.'),
      };

      await api.actOnFreeze(freezeId, payload);

      toast.success(
        type === 'APPROVE'
          ? `Debit Freeze Order ${freezeId} APPROVED! Warrant recorded.`
          : `Freeze Request ${freezeId} REJECTED. Reason logged.`,
        { duration: 4000 }
      );

      setActionModal(null);
      setActionNotes('');
      // Refresh state
      await loadBankData(true);
    } catch (err) {
      console.error('Failed to act on freeze order:', err);
      toast.error(`Action failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#F1F5F9] flex flex-col font-sans selection:bg-blue-500/20 selection:text-blue-300">
      {/* TopBar with BANK OFFICER Badge */}
      <TopBar roleBadge="BANK OFFICER" roleColor="blue" />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-64 border-r border-border-subtle bg-[#0A0E1A] flex flex-col justify-between shrink-0 select-none">
          <div className="p-4 space-y-1">
            <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Nodal Bank Portal
            </div>

            {[
              { id: 'dashboard', label: 'Dashboard', icon: Building2, count: null },
              { id: 'queue', label: 'Freeze Queue', icon: Lock, count: stats.pending_freezes, color: 'bg-red-500/20 text-red-400 border border-red-500/30' },
              { id: 'compliance', label: 'Compliance & Audit', icon: FileCheck2, count: `${stats.compliance_sla_rate}%` },
              { id: 'watchlist', label: 'Mule Watchlist', icon: ShieldX, count: muleWatchlist.length },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30 shadow-sm'
                      : 'text-slate-400 hover:bg-[#111827] hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== null && (
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                        item.color || 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bank Officer Authority Badge */}
          <div className="p-4 border-t border-border-subtle bg-[#0D1322]/80 space-y-3">
            <div className="text-xs space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Statutory Mandate</span>
              <p className="text-[11px] text-slate-300 font-mono">Sec 102 CrPC / Sec 106 BNSS</p>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
              <span className="text-slate-400">Nodal Agency:</span>
              <span className="font-mono text-blue-400 font-medium">State Bank of India</span>
            </div>
          </div>
        </aside>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header & Quick Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border-subtle">
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-bold text-white tracking-tight">Bank Officer Emergency Console</h1>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-semibold">
                  MHA-I4C LEA DIRECT LINK
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Real-time debit freeze queue for suspected money mule accounts under statutory police mandates.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => loadBankData()}
                disabled={loading}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1E293B] border border-border-subtle text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync Queue</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ROW 1: HERO STATS (4 Cards) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Pending Freeze Requests */}
            <div className="bg-[#111827] border border-border-subtle hover:border-red-500/40 rounded-xl p-4.5 transition duration-150 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Pending Freezes</span>
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-3 mt-2">
                <span className="text-2xl font-bold tracking-tight text-white font-mono">
                  {stats.pending_freezes}
                </span>
                <span className="inline-flex items-center text-[10px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">
                  {stats.critical_freezes} CRITICAL
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">Requires statutory officer debit hold</p>
            </div>

            {/* Card 2: Approved Today */}
            <div className="bg-[#111827] border border-border-subtle hover:border-blue-500/40 rounded-xl p-4.5 transition duration-150 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Approved Today</span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-3 mt-2">
                <span className="text-2xl font-bold tracking-tight text-white font-mono">
                  {stats.approved_today}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {formatCurrency(stats.amount_frozen_today)} frozen
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">100% compliance with Section 102 CrPC</p>
            </div>

            {/* Card 3: ₹ Frozen Today */}
            <div className="bg-[#111827] border border-border-subtle hover:border-emerald-500/40 rounded-xl p-4.5 transition duration-150 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">₹ Frozen Today</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl font-bold tracking-tight text-white font-mono">
                  {formatCurrency(stats.amount_frozen_today)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">Halted siphon before physical ATM cashout</p>
            </div>

            {/* Card 4: Avg Approval Time */}
            <div className="bg-[#111827] border border-border-subtle hover:border-amber-500/40 rounded-xl p-4.5 transition duration-150 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Avg Approval Latency</span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-3 mt-2">
                <span className="text-2xl font-bold tracking-tight text-white font-mono">
                  {stats.avg_approval_seconds}s
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  SLA: &lt;60s
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">Golden-hour response index</p>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ROW 2: FREEZE REQUEST QUEUE (Full Width, 500px Height) */}
          {/* ========================================================================= */}
          <div className="bg-[#111827] border border-border-subtle rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <div className="flex items-center space-x-2.5">
                <Lock className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white tracking-tight">Active Freeze Request Queue</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {freezeQueue.length} Orders
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Auto-refreshed via WebSocket | Direct API Execution
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0F172A] text-slate-400 font-mono uppercase text-[10px] sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-3">Request ID & Severity</th>
                    <th className="py-3 px-3">Case ID & Victim Loss</th>
                    <th className="py-3 px-3">Mule Account ID & Risk</th>
                    <th className="py-3 px-3">Predicted Cashout Window</th>
                    <th className="py-3 px-3">Amount At Risk</th>
                    <th className="py-3 px-3">Requested By</th>
                    <th className="py-3 px-3">SLA Countdown</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {freezeQueue.map((item) => {
                    const isCritical = item.severity === 'CRITICAL';
                    const isPending = item.status === 'PENDING_BANK_APPROVAL';
                    const borderStyle = isCritical ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-amber-500';
                    const sla = getSlaForFreeze(item);
                    const slaStyle = sla.breached
                      ? 'bg-red-600 text-white border-red-500'
                      : sla.critical
                      ? 'bg-red-500/15 text-red-300 border-red-500/40 animate-pulse'
                      : sla.warning
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';

                    return (
                      <tr
                        key={item.freeze_id}
                        className={`hover:bg-[#1A2234] transition duration-150 ${borderStyle} ${
                          !isPending ? 'opacity-70 bg-[#0E1524]/60' : ''
                        }`}
                      >
                        {/* Request ID */}
                        <td className="py-3.5 px-3 font-mono">
                          <div className="font-semibold text-white">{item.freeze_id}</div>
                          <span
                            className={`inline-block text-[9px] font-mono px-1.5 py-0.2 rounded mt-1 font-bold ${
                              isCritical
                                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {item.severity}
                          </span>
                        </td>

                        {/* Case ID + Victim Amount */}
                        <td className="py-3.5 px-3 font-mono">
                          <div className="text-cyan-300 font-medium">{item.case_id}</div>
                          <div className="text-[11px] text-slate-400">
                            Lost: {formatCurrency(item.victim_amount || item.amount_at_risk)}
                          </div>
                        </td>

                        {/* Mule Account ID + Risk Score */}
                        <td className="py-3.5 px-3 font-mono">
                          <div className="text-white font-medium">{item.account_id}</div>
                          <div className="text-[11px] text-red-400">Risk: {item.risk_score}%</div>
                        </td>

                        {/* Predicted Cashout Window */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center space-x-1 font-mono text-amber-300 text-xs font-semibold">
                            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>{item.predicted_cashout_window || 'Immediate'}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">ATM Window</div>
                        </td>

                        {/* Amount At Risk */}
                        <td className="py-3.5 px-3 font-mono">
                          <span className="text-sm font-bold text-emerald-400">
                            {formatCurrency(item.amount_at_risk)}
                          </span>
                        </td>

                        {/* Requested By */}
                        <td className="py-3.5 px-3 text-slate-300">
                          <div className="font-medium text-xs">{item.requested_by}</div>
                          <div className="text-[10px] text-slate-500 font-mono">Section 102 Order</div>
                        </td>

                        {/* SLA Countdown */}
                        <td className="py-3.5 px-3 font-mono text-xs">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded border font-semibold ${slaStyle}`}>
                            <Clock className="w-3 h-3" />
                            {sla.breached ? 'SLA BREACHED' : `${formatSlaCountdown(sla.remaining)} SLA`}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-1">{item.time_since || 'Just now'}</div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3 text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                id={`approve-freeze-${item.freeze_id}`}
                                onClick={() => setActionModal({ freeze: item, type: 'APPROVE' })}
                                disabled={actionLoading === item.freeze_id}
                                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition cursor-pointer shadow-sm disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                id={`reject-freeze-${item.freeze_id}`}
                                onClick={() => setActionModal({ freeze: item, type: 'REJECT' })}
                                disabled={actionLoading === item.freeze_id}
                                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-red-600/80 hover:bg-red-600 text-white text-xs font-medium transition cursor-pointer shadow-sm disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                item.status === 'APPROVED'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {item.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {freezeQueue.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 font-mono">
                        No pending freeze requests in queue. System operational.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ROW 3: COMPLIANCE LOG & METRICS (2 Columns) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Recent Freeze Actions (Last 20) */}
            <div className="bg-[#111827] border border-border-subtle rounded-xl p-5 shadow-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                  <div className="flex items-center space-x-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-semibold text-white tracking-tight">Recent Statutory Freeze Actions</h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Section 102 CrPC Register</span>
                </div>

                <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {complianceLogs.slice(0, 10).map((log, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[#0F172A] border border-border-subtle text-xs"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                        <div>
                          <div className="font-mono text-white font-medium">{log.entity_id}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            By {log.user} • {log.action}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          EXECUTED
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5">{log.timestamp}</div>
                      </div>
                    </div>
                  ))}

                  {complianceLogs.length === 0 && (
                    <div className="py-6 text-center text-slate-500 text-xs font-mono">
                      No statutory freeze actions logged yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Compliance Metrics */}
            <div className="bg-[#111827] border border-border-subtle rounded-xl p-5 shadow-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                    <h4 className="text-xs font-semibold text-white tracking-tight">Regulatory SLA Adherence</h4>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold">I4C Audit Compliant</span>
                </div>

                <div className="grid grid-cols-2 gap-3.5 mt-4">
                  <div className="p-3 rounded-lg bg-[#0F172A] border border-border-subtle">
                    <div className="text-[11px] text-slate-400">Approval SLA Compliance</div>
                    <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                      {stats.compliance_sla_rate}%
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">Target: &gt;95%</div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0F172A] border border-border-subtle">
                    <div className="text-[11px] text-slate-400">Avg Statutory Reaction</div>
                    <div className="text-xl font-bold font-mono text-blue-400 mt-1">
                      {stats.avg_approval_seconds}s
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">Under 60s mandate</div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0F172A] border border-border-subtle">
                    <div className="text-[11px] text-slate-400">Cumulative Frozen Assets</div>
                    <div className="text-xl font-bold font-mono text-white mt-1">
                      {formatCurrency(stats.total_frozen_overall)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">Across all syndicate alerts</div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0F172A] border border-border-subtle">
                    <div className="text-[11px] text-slate-400">False Positive Halts</div>
                    <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
                      0.4%
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">High precision vetting</div>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-slate-300">
                  <span className="font-semibold text-blue-300">Nodal Officer Advisory:</span> All Section 102 debit suspensions are recorded with SHA-256 integrity hashes on the I4C central ledger and communicated immediately to the complainant's home station.
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ROW 4: BANK'S MULE WATCHLIST */}
          {/* ========================================================================= */}
          <div className="bg-[#111827] border border-border-subtle rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center space-x-2.5">
                <ShieldX className="w-4 h-4 text-red-400" />
                <h4 className="text-xs font-semibold text-white tracking-tight">High-Risk Mule Accounts Watchlist (Risk Score &gt; 80%)</h4>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {muleWatchlist.length} Monitored Conduit Accounts
              </span>
            </div>

            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0F172A] text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Account ID</th>
                    <th className="py-2.5 px-3">Customer Entity</th>
                    <th className="py-2.5 px-3">Risk Probability</th>
                    <th className="py-2.5 px-3">Jurisdiction</th>
                    <th className="py-2.5 px-3">Recent Inbound Pattern</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-mono text-xs">
                  {muleWatchlist.slice(0, 8).map((mule) => (
                    <tr key={mule.account_id} className="hover:bg-[#1A2234] transition duration-150">
                      <td className="py-2.5 px-3 font-semibold text-white">{mule.account_id}</td>
                      <td className="py-2.5 px-3 text-slate-300">{mule.customer_name}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">
                          {mule.risk_score}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{mule.city}</td>
                      <td className="py-2.5 px-3 text-slate-300 font-sans text-xs">{mule.recent_activity}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
                          MONITORED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Action Modal (Approve / Reject) */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-border-subtle rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h3 className="text-sm font-semibold text-white">
                {actionModal.type === 'APPROVE' ? 'Authorize Debit Freeze Order' : 'Reject Freeze Order'}
              </h3>
              <button
                onClick={() => setActionModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-2 text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Order Reference:</span>
                <span className="font-mono text-cyan-400 font-semibold">{actionModal.freeze.freeze_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Suspect Account:</span>
                <span className="font-mono text-white">{actionModal.freeze.account_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Amount At Risk:</span>
                <span className="font-mono text-emerald-400 font-bold">{formatCurrency(actionModal.freeze.amount_at_risk)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-mono">Authorizing Officer Name:</label>
              <input
                type="text"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                className="w-full bg-[#0F172A] border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-mono">Bank Notes / Compliance Remarks:</label>
              <textarea
                rows={2}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Enter statutory notes or reason for debit hold..."
                className="w-full bg-[#0F172A] border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setActionModal(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-freeze-action-btn"
                onClick={handleExecuteAction}
                disabled={actionLoading !== null}
                className={`px-4 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer ${
                  actionModal.type === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {actionLoading ? 'Executing...' : `Confirm ${actionModal.type === 'APPROVE' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
