/**
 * ==============================================================================
 * MuleShield (SIH26184) - Trend Analytics Charts (Row 5)
 * ==============================================================================
 * 3 Recharts Visualizations:
 * 1. 30-Day Fraud Incident & Financial Volume Trajectory (Area Chart)
 * 2. Diurnal ATM Withdrawal Velocity by Hour (Bar Chart)
 * 3. Cash-Out Destination Ratio: 70% Syndicate Corridor vs 30% Local (Pie Chart)
 * ==============================================================================
 */

import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Clock, PieChart as PieIcon } from 'lucide-react';
import { useAppStore } from '../store/appStore';

// Mock Diurnal Hourly Distribution if backend doesn't provide granular hours
const HOURLY_DATA = [
  { hour: '00', withdrawals: 45 },
  { hour: '03', withdrawals: 20 },
  { hour: '06', withdrawals: 35 },
  { hour: '09', withdrawals: 110 },
  { hour: '12', withdrawals: 240 },
  { hour: '14', withdrawals: 390 }, // Peak golden hour
  { hour: '16', withdrawals: 460 },
  { hour: '18', withdrawals: 380 },
  { hour: '20', withdrawals: 290 },
  { hour: '22', withdrawals: 180 },
];

// 70% Syndicate Hub vs 30% Local Victim City
const DESTINATION_DATA = [
  { name: 'Syndicate Hubs (Gurugram/Mewat/Jamtara)', value: 70, color: '#EF4444' },
  { name: 'Local Victim Metro', value: 30, color: '#06B6D4' },
];

export default function TrendCharts() {
  const { trends, loading } = useAppStore();

  const trendPoints =
    trends?.trends && trends.trends.length > 0
      ? trends.trends
      : [
          { date: '07-01', complaints: 14, amount_at_risk: 450000 },
          { date: '07-05', complaints: 22, amount_at_risk: 680000 },
          { date: '07-10', complaints: 19, amount_at_risk: 590000 },
          { date: '07-15', complaints: 28, amount_at_risk: 920000 },
          { date: '07-20', complaints: 35, amount_at_risk: 1250000 },
        ];

  if (loading.trends) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-[#111827] border border-border-subtle rounded-xl p-5 h-64 animate-pulse">
            <div className="h-4 w-32 bg-slate-800 rounded mb-4"></div>
            <div className="h-44 bg-slate-800/40 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
      {/* Chart 1: 30-Day Fraud Incident Curve */}
      <div className="bg-[#111827] border border-border-subtle rounded-xl p-5 shadow-card flex flex-col justify-between">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-semibold text-white tracking-tight">30-Day Incident Volume</h4>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
            Temporal Trajectory
          </span>
        </div>

        <div className="h-48 w-full mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #1E293B',
                  borderRadius: '6px',
                  fontSize: '11px',
                }}
              />
              <Area type="monotone" dataKey="complaints" stroke="#06B6D4" strokeWidth={2} fill="url(#cyanGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Hourly ATM Withdrawal Velocity */}
      <div className="bg-[#111827] border border-border-subtle rounded-xl p-5 shadow-card flex flex-col justify-between">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-semibold text-white tracking-tight">Diurnal Cash-Out Velocity</h4>
          </div>
          <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
            Peak: 14:00 - 18:00
          </span>
        </div>

        <div className="h-48 w-full mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={HOURLY_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="hour" stroke="#64748B" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #1E293B',
                  borderRadius: '6px',
                  fontSize: '11px',
                }}
              />
              <Bar dataKey="withdrawals" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 3: Cash-Out Destination Ratio (70/30) */}
      <div className="bg-[#111827] border border-border-subtle rounded-xl p-5 shadow-card flex flex-col justify-between">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center space-x-2">
            <PieIcon className="w-4 h-4 text-red-400" />
            <h4 className="text-xs font-semibold text-white tracking-tight">Withdrawal Destination Ratio</h4>
          </div>
          <span className="text-[10px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">
            70% Hub / 30% Local
          </span>
        </div>

        <div className="h-48 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={DESTINATION_DATA}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={68}
                paddingAngle={4}
                dataKey="value"
              >
                {DESTINATION_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val) => `${val}%`}
                contentStyle={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #1E293B',
                  borderRadius: '6px',
                  fontSize: '11px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
