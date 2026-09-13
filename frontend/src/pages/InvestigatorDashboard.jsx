/**
 * ==============================================================================
 * MuleShield (SIH26184) - Flagship Investigator Dashboard Page
 * ==============================================================================
 * Central layout combining:
 * - Row 1: Hero KPI Cards (Active Cases, Alerts, ₹ At Risk, Connected Clients)
 * - Row 2: 3D MapLibre Risk Heatmap & Forecast Epicenters
 * - Row 3: Ranked Cash-Out Zones (60%) + Real-Time Live Alerts Feed (40%)
 * - Row 4: Forensic Case Dossier Panel (Complainant, SVG Mule Graph, Bank Freeze)
 * - Row 5: 3 Trend Charts (30-day curve, hourly velocity, 70/30 destination ratio)
 * ==============================================================================
 */

import React, { useRef } from 'react';
import StatCards from '../components/StatCards';
import RiskMap from '../components/RiskMap';
import TopZonesList from '../components/TopZonesList';
import AlertsFeed from '../components/AlertsFeed';
import CaseDetailPanel from '../components/CaseDetailPanel';
import TrendCharts from '../components/TrendCharts';
import { useAppStore } from '../store/appStore';
import { FolderKanban, Share2, FileText, CheckCircle2 } from 'lucide-react';

export default function InvestigatorDashboard({ activeTab }) {
  const { cases, alerts, selectCase, selectedCase } = useAppStore();
  const caseDetailRef = useRef(null);

  const handleFocusCase = (caseId) => {
    selectCase(caseId);
    if (caseDetailRef.current) {
      caseDetailRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Render Alternate Views if non-dashboard tab is selected from sidebar
  if (activeTab === 'cases') {
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Active Cases Docket</h2>
            <p className="text-xs text-slate-400 font-mono">Central Cybercrime First Information Records</p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300">
            {cases.length} Total Cases
          </span>
        </div>

        <div className="bg-[#111827] border border-border-subtle rounded-xl overflow-hidden shadow-card">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0D1322] text-slate-400 font-mono uppercase text-[10px] border-b border-border-subtle">
              <tr>
                <th className="p-3.5">Case Reference</th>
                <th className="p-3.5">Complainant</th>
                <th className="p-3.5">City / Location</th>
                <th className="p-3.5">Fraud Typology</th>
                <th className="p-3.5">₹ Amount Lost</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {cases.map((c) => (
                <tr key={c.case_id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3.5 font-mono font-bold text-cyan-400">{c.case_id}</td>
                  <td className="p-3.5 text-white font-medium">{c.victim_info?.name}</td>
                  <td className="p-3.5 text-slate-300">{c.victim_info?.city}</td>
                  <td className="p-3.5 text-amber-400">{c.victim_info?.fraud_type}</td>
                  <td className="p-3.5 font-mono font-bold text-white">
                    ₹{c.victim_info?.amount_lost?.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                        c.status === 'CONFIRMED_FRAUD'
                          ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                          : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => handleFocusCase(c.case_id)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-300 font-mono transition cursor-pointer"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedCase && (
          <div ref={caseDetailRef}>
            <CaseDetailPanel />
          </div>
        )}
      </div>
    );
  }

  if (activeTab === 'graph') {
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Mule Syndicate Ring Topology</h2>
            <p className="text-xs text-slate-400 font-mono">
              Louvain Communities & GNN Graph Embeddings (1,700 Nodes / 3,594 Edges)
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-400">
            5 Critical Rings Detected
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { id: 'RING_001', size: 6, devices: 2, purity: 1.0, cities: 'Gurugram, Jamtara, Mewat, Noida', sample: 'M00024, M00029, M00064...' },
            { id: 'RING_002', size: 13, devices: 5, purity: 0.99, cities: 'Hyderabad, Gurugram, Jamtara', sample: 'M00007, M00010, M00014...' },
            { id: 'RING_003', size: 12, devices: 7, purity: 0.98, cities: 'Gurugram, Jamtara, Mewat, Noida', sample: 'M00026, M00046, M00061...' },
            { id: 'RING_004', size: 14, devices: 4, purity: 0.98, cities: 'Gurugram, Jamtara, Mewat', sample: 'M00001, M00002, M00039...' },
            { id: 'RING_005', size: 15, devices: 6, purity: 0.98, cities: 'Noida, Jamtara, Mewat', sample: 'M00004, M00032, M00037...' },
          ].map((ring) => (
            <div key={ring.id} className="p-5 rounded-xl bg-[#111827] border border-slate-800 hover:border-red-500/50 transition">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-mono font-bold text-sm text-red-400">{ring.id}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20 font-semibold">
                  Purity: {(ring.purity * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-3 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Mule Members:</span>
                  <span className="text-white font-bold">{ring.size} accounts</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Shared IMEIs:</span>
                  <span className="text-amber-400">{ring.devices} devices</span>
                </div>
                <div className="text-slate-400 pt-1">
                  <span className="block text-[11px] text-slate-500 mb-0.5">Operating Corridors:</span>
                  <span className="text-cyan-300 font-sans">{ring.cities}</span>
                </div>
                <div className="text-slate-400 pt-1">
                  <span className="block text-[11px] text-slate-500 mb-0.5">Sample Mule Nodes:</span>
                  <span className="text-slate-300 text-[10px]">{ring.sample}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default Flagship Investigator Dashboard Assembly
  return (
    <div className="p-5 max-w-[1720px] mx-auto space-y-5">
      {/* Row 1: Hero KPI Cards */}
      <StatCards />

      {/* Row 2: 3D Geospatial Tactical Risk Map */}
      <RiskMap />

      {/* Row 3: Ranked Cash-Out Zones (60%) + Real-Time Live Alerts Feed (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7">
          <TopZonesList onDispatchZone={(zone) => {}} />
        </div>
        <div className="lg:col-span-5">
          <AlertsFeed onViewCase={handleFocusCase} />
        </div>
      </div>

      {/* Row 4: Forensic Case Dossier Panel (if a case is selected) */}
      <div ref={caseDetailRef}>
        <CaseDetailPanel />
      </div>

      {/* Row 5: Trend Charts */}
      <TrendCharts />
    </div>
  );
}
