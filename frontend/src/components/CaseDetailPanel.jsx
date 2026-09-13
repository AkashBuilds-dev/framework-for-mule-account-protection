/**
 * ==============================================================================
 * MuleShield (SIH26184) - Case Dossier & Forensic Detail Panel (Row 4)
 * ==============================================================================
 * Comprehensive investigative breakdown:
 * - Complainant Dossier & Fraud Typology
 * - Interactive SVG Mule Network Topology (Victim -> Suspect -> Mules -> Devices)
 * - Predicted ATM Cash-Out Corridor & Nearest Terminals
 * - Statutory Law Enforcement Actions (Section 102 CrPC Bank Freeze, Field Patrol)
 * ==============================================================================
 */

import React, { useState } from 'react';
import {
  X,
  Shield,
  User,
  Phone,
  MapPin,
  Clock,
  IndianRupee,
  Share2,
  Lock,
  Send,
  CheckCircle,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { toast } from 'react-hot-toast';

export default function CaseDetailPanel() {
  const { selectedCase, clearSelectedCase, requestFreeze, submitCaseFeedback } = useAppStore();
  const [isSubmittingFreeze, setIsSubmittingFreeze] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');

  if (!selectedCase) return null;

  const { victim_info, suspect_info, resolved_entity, predicted_cashout_zones, escalation_status, case_id } =
    selectedCase;

  const handleBankFreeze = async () => {
    setIsSubmittingFreeze(true);
    try {
      await requestFreeze({
        account_id: suspect_info.account_id,
        case_id: case_id,
        bank_name: 'State Bank of India',
        freeze_reason: `Suspected primary mule conduit in case ${case_id} (${victim_info.fraud_type})`,
        requested_by: 'Cybercrime Emergency Cell (SIH26184)',
        risk_score: suspect_info.risk_score || 98.0,
        amount_at_risk: victim_info.amount_lost,
      });
    } finally {
      setIsSubmittingFreeze(false);
    }
  };

  const handleFeedback = async (status) => {
    await submitCaseFeedback(case_id, status, feedbackNotes || `Marked as ${status} after forensic review.`);
  };

  return (
    <div className="bg-[#111827] border border-cyan-500/40 rounded-xl p-5 shadow-2xl mb-5 transition-all duration-200">
      {/* Dossier Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-semibold text-white tracking-tight">
                Forensic Case Dossier: {case_id}
              </h2>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                  selectedCase.status === 'CONFIRMED_FRAUD'
                    ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                    : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                }`}
              >
                {selectedCase.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Filed at {selectedCase.created_at} • Escalation SLA: {escalation_status?.sla_minutes || 15} min
            </p>
          </div>
        </div>

        <button
          onClick={clearSelectedCase}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Grid: 3 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-4">
        {/* Column 1: Victim Profile & Incident Details */}
        <div className="space-y-4">
          <div className="bg-[#0A0E1A] p-4 rounded-lg border border-slate-800 space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center">
              <User className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
              Complainant Profile
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Name:</span>
                <span className="text-white font-medium">{victim_info.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone:</span>
                <span className="text-slate-300 font-mono">{victim_info.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Location:</span>
                <span className="text-slate-300">
                  {victim_info.city} ({victim_info.lat.toFixed(4)}, {victim_info.lon.toFixed(4)})
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800/80">
                <span className="text-slate-500">Amount Siphoned:</span>
                <span className="text-base font-bold text-white font-mono">
                  ₹{victim_info.amount_lost.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fraud Typology:</span>
                <span className="text-amber-400 font-medium">{victim_info.fraud_type}</span>
              </div>
            </div>

            {victim_info.notes && (
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-500 block mb-1">Investigative Intake Notes:</span>
                <p className="text-xs text-slate-300 italic bg-[#111827] p-2 rounded border border-slate-800 leading-relaxed">
                  "{victim_info.notes}"
                </p>
              </div>
            )}
          </div>

          {/* Statutory Enforcement Actions */}
          <div className="bg-[#0A0E1A] p-4 rounded-lg border border-slate-800 space-y-2.5">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center">
              <Lock className="w-3.5 h-3.5 mr-1.5 text-red-400" />
              Statutory Interventions
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleBankFreeze}
                disabled={isSubmittingFreeze}
                className="py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition shadow-lg shadow-red-600/20 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isSubmittingFreeze ? 'Sending...' : 'Bank Freeze (Sec 102)'}</span>
              </button>

              <button
                onClick={() =>
                  toast.success(`Intervention unit dispatched to target corridor for case ${case_id}!`, {
                    icon: '🚨',
                  })
                }
                className="py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition shadow-lg shadow-cyan-600/20 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Dispatch Unit</span>
              </button>
            </div>

            {/* Closed-Loop Feedback */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleFeedback('CONFIRMED_FRAUD')}
                  className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-300 rounded border border-slate-700 text-xs font-medium transition cursor-pointer"
                >
                  Confirm Fraud
                </button>
                <button
                  onClick={() => handleFeedback('FALSE_POSITIVE')}
                  className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-300 rounded border border-slate-700 text-xs font-medium transition cursor-pointer"
                >
                  False Positive
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Interactive SVG Mule Network Topology */}
        <div className="bg-[#0A0E1A] p-4 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center">
              <Share2 className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
              Syndicate Ring Topology
            </h4>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
              {resolved_entity?.total_connected_nodes || 4} Nodes Resolved
            </span>
          </div>

          {/* SVG Visual Graph */}
          <div className="w-full h-56 flex items-center justify-center relative my-2">
            <svg className="w-full h-full" viewBox="0 0 320 200">
              {/* Directed Edges */}
              {/* Edge: Victim -> Suspect */}
              <line x1="50" y1="100" x2="150" y2="100" stroke="#06B6D4" strokeWidth="2" strokeDasharray="3,3" />
              {/* Edge: Suspect -> Mule Accomplice 1 */}
              <line x1="160" y1="90" x2="250" y2="50" stroke="#EF4444" strokeWidth="2" />
              {/* Edge: Suspect -> Mule Accomplice 2 */}
              <line x1="160" y1="110" x2="250" y2="150" stroke="#EF4444" strokeWidth="2" />
              {/* Edge: Suspect -> Shared Device */}
              <line x1="160" y1="100" x2="210" y2="100" stroke="#F59E0B" strokeWidth="1.5" />

              {/* Node 1: Victim */}
              <circle cx="50" cy="100" r="18" fill="#111827" stroke="#06B6D4" strokeWidth="2" />
              <text x="50" y="104" textAnchor="middle" fill="#06B6D4" fontSize="10" fontWeight="bold">
                VICTIM
              </text>

              {/* Node 2: Primary Suspect */}
              <circle cx="160" cy="100" r="22" fill="#111827" stroke="#EF4444" strokeWidth="3" />
              <text x="160" y="98" textAnchor="middle" fill="#EF4444" fontSize="9" fontWeight="bold">
                {suspect_info.account_id}
              </text>
              <text x="160" y="110" textAnchor="middle" fill="#94A3B8" fontSize="8">
                {(suspect_info.risk_score || 98.5).toFixed(0)}%
              </text>

              {/* Node 3: Mule Accomplice 1 */}
              <circle cx="260" cy="50" r="15" fill="#111827" stroke="#EF4444" strokeWidth="1.5" />
              <text x="260" y="54" textAnchor="middle" fill="#EF4444" fontSize="8" fontWeight="bold">
                {resolved_entity?.mule_ids?.[1] || 'M00024'}
              </text>

              {/* Node 4: Mule Accomplice 2 */}
              <circle cx="260" cy="150" r="15" fill="#111827" stroke="#EF4444" strokeWidth="1.5" />
              <text x="260" y="154" textAnchor="middle" fill="#EF4444" fontSize="8" fontWeight="bold">
                {resolved_entity?.mule_ids?.[2] || 'M00039'}
              </text>

              {/* Node 5: Shared Device */}
              <rect x="195" y="88" width="28" height="24" rx="4" fill="#1E293B" stroke="#F59E0B" strokeWidth="1.5" />
              <text x="209" y="103" textAnchor="middle" fill="#F59E0B" fontSize="8" fontWeight="bold">
                IMEI
              </text>
            </svg>
          </div>

          <div className="bg-[#111827] p-2.5 rounded border border-slate-800 text-[11px] font-mono space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Layering Flow:</span>
              <span className="text-cyan-300">
                {resolved_entity?.layering_inflow_count || 1} In / {resolved_entity?.layering_outflow_count || 2} Out
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Syndicate Ring:</span>
              <span className="text-red-400 font-semibold">
                {resolved_entity?.is_syndicate_member ? 'RING_004 (Active)' : 'Unassigned'}
              </span>
            </div>
          </div>
        </div>

        {/* Column 3: Predicted Cash-Out Corridor & ATM Targets */}
        <div className="bg-[#0A0E1A] p-4 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center">
                <MapPin className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                Target ATM Corridor
              </h4>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                Golden Hour
              </span>
            </div>

            <div className="space-y-2 mt-3">
              {predicted_cashout_zones?.slice(0, 3).map((zone, idx) => (
                <div key={idx} className="p-2 rounded bg-[#111827] border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-cyan-400">{zone.cell_id}</span>
                    <span className="text-[10px] font-mono text-red-400">
                      {(zone.risk_score * 100).toFixed(0)}% Probability
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">{zone.city} Syndicate Hub</p>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Window: {zone.predicted_withdrawal_window}</span>
                    <span>₹{zone.estimated_amount_at_risk?.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800">
            <span className="text-[10px] text-slate-500 font-mono block mb-1">Nearest Monitored Terminals:</span>
            <div className="flex flex-wrap gap-1">
              {predicted_cashout_zones?.[0]?.nearest_atms?.map((atm, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300"
                >
                  {atm}
                </span>
              )) || <span className="text-xs text-slate-500">ATM_006, ATM_015</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
