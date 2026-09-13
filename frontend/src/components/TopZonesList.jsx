/**
 * ==============================================================================
 * MuleShield (SIH26184) - Ranked High-Risk Withdrawal Zones (Row 3 Left - 60%)
 * ==============================================================================
 * Renders prioritized Top 20 cash-out zones with:
 * - Left border color-coding by risk severity
 * - Dynamic risk progress bars & golden-hour time windows
 * - One-click field team dispatch
 * - ADDITION 5: Loading skeleton shimmers
 * - ADDITION 6: Professional empty state ("Awaiting first complaint.")
 * ==============================================================================
 */

import React, { useState } from 'react';
import { MapPin, Clock, IndianRupee, Send, ShieldAlert, CheckCircle, MapPinOff } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { toast } from 'react-hot-toast';

export default function TopZonesList({ onDispatchZone }) {
  const { topZones, loading, setMapTarget } = useAppStore();
  const [dispatchedCells, setDispatchedCells] = useState(new Set());

  const handleDispatch = (zone) => {
    setDispatchedCells((prev) => new Set(prev).add(zone.cell_id));
    toast.success(`Emergency LEA Patrol unit dispatched to ${zone.city} (${zone.cell_id})!`, {
      icon: '🚨',
      style: { background: '#111827', color: '#F1F5F9', border: '1px solid #EF4444' },
    });
    if (onDispatchZone) onDispatchZone(zone);
  };

  const handleFocusZone = (zone) => {
    setMapTarget({
      lat: zone.lat,
      lon: zone.lon,
      zoom: 13,
      pitch: 55,
    });
  };

  // ADDITION 5: Skeleton Shimmer Loader
  if (loading.zones) {
    return (
      <div className="bg-[#111827] border border-border-subtle rounded-xl p-5 shadow-card h-[450px] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="h-4 w-48 bg-slate-800 rounded animate-pulse"></div>
          <div className="h-4 w-20 bg-slate-800 rounded animate-pulse"></div>
        </div>
        <div className="space-y-3 mt-4 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-800/50 rounded-lg animate-pulse border border-slate-800"></div>
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
          <div className="w-6 h-6 rounded bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Ranked Cash-Out Zones
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Top 20 Predicted ATM Corridors by Spatial Regression
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
          {topZones.length} Zones Ranked
        </span>
      </div>

      {/* Zone List / ADDITION 6: Empty State */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 mt-3.5">
        {!topZones || topZones.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
            <MapPinOff className="w-9 h-9 text-slate-500 stroke-[1.5]" />
            <p className="text-sm font-medium text-[#94A3B8]">Awaiting first complaint.</p>
            <p className="text-xs text-slate-600 font-mono max-w-xs">
              Spatial predictor will rank likely ATM withdrawal clusters once a complaint is filed.
            </p>
          </div>
        ) : (
          topZones.map((zone, idx) => {
            const riskPct = Math.round(zone.risk_score * 100);
            const isCritical = zone.risk_score >= 0.75;
            const isMedium = zone.risk_score >= 0.5 && zone.risk_score < 0.75;
            const isDispatched = dispatchedCells.has(zone.cell_id);

            const borderColor = isCritical
              ? 'border-l-red-500'
              : isMedium
              ? 'border-l-amber-500'
              : 'border-l-cyan-500';

            return (
              <div
                key={zone.cell_id || idx}
                className={`group p-3 rounded-lg bg-[#0E1526] hover:bg-[#141C30] border border-slate-800 border-l-4 ${borderColor} transition duration-150 flex items-center justify-between space-x-3`}
              >
                {/* Left: Rank & Cell Identification */}
                <div className="flex items-center space-x-3 min-w-0 cursor-pointer" onClick={() => handleFocusZone(zone)}>
                  <div className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-[11px] font-bold text-slate-300 shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-semibold text-cyan-400 truncate">
                        {zone.cell_id}
                      </span>
                      <span className="text-xs font-medium text-white truncate">
                        {zone.city}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="flex items-center font-mono text-amber-300">
                        <Clock className="w-3 h-3 mr-1" />
                        {zone.predicted_withdrawal_window || 'Golden Hour active'}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-slate-300">
                        ₹{(zone.estimated_amount_at_risk || 45000).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Progress bar & Dispatch Action */}
                <div className="flex items-center space-x-3 shrink-0">
                  {/* Risk Score Pill & Bar */}
                  <div className="w-24 text-right">
                    <div className="flex items-center justify-end space-x-1 mb-1">
                      <span className="text-[11px] font-mono font-bold text-white">
                        {riskPct}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">RISK</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isCritical ? 'bg-red-500' : isMedium ? 'bg-amber-500' : 'bg-cyan-500'
                        }`}
                        style={{ width: `${riskPct}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Dispatch Button */}
                  <button
                    onClick={() => handleDispatch(zone)}
                    disabled={isDispatched}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition ${
                      isDispatched
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-default'
                        : 'bg-slate-800 hover:bg-cyan-600 hover:text-white border border-slate-700 text-slate-200 cursor-pointer active:scale-95'
                    }`}
                    title="Dispatch Local Law Enforcement Vehicle to monitored ATM corridor"
                  >
                    {isDispatched ? (
                      <>
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span>Dispatched</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3 text-cyan-400 group-hover:text-white" />
                        <span>Dispatch</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
