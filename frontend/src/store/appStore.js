/**
 * ==============================================================================
 * MuleShield (SIH26184) - Central Zustand Application Store
 * ==============================================================================
 * Single source of truth for:
 * - Real-time cases, alerts queue, and high-risk withdrawal zones
 * - 410-cell GeoJSON grid and DBSCAN hotspot clusters
 * - Live WebSocket status & telemetry
 * - Map camera synchronization and focus targets
 * ==============================================================================
 */

import { create } from 'zustand';
import { toast } from 'react-hot-toast';
import { api } from '../api/client';

export const useAppStore = create((set, get) => ({
  // ----------------------------------------------------------------------------
  // State Properties
  // ----------------------------------------------------------------------------
  stats: {
    total_cases: 0,
    active_alerts: 0,
    total_amount_at_risk: 0,
    total_mules_flagged: 0,
    freeze_requests_pending: 0,
    high_risk_zones_active: 0,
    connected_clients: 0,
    system_status: 'OPERATIONAL',
  },
  cases: [],
  selectedCase: null,
  alerts: [],
  topZones: [],
  gridGeojson: null,
  trends: null,
  hotspots: [],
  
  // Real-time & Telemetry
  wsStatus: 'disconnected', // 'connected' | 'reconnecting' | 'disconnected'
  lastSync: new Date().toISOString(),
  apiError: false,
  apiErrorMessage: '',

  // Loading Skeletons State (ADDITION 5)
  loading: {
    stats: true,
    cases: true,
    alerts: true,
    zones: true,
    map: true,
    trends: true,
  },

  // Map camera trigger
  mapTarget: null, // { lat, lon, zoom, pitch }

  // ----------------------------------------------------------------------------
  // Actions
  // ----------------------------------------------------------------------------

  setWsStatus: (status) => set({ wsStatus: status }),

  setMapTarget: (target) => set({ mapTarget: target }),

  fetchInitialData: async () => {
    // 1. Fetch Overview Stats
    api.getStatsOverview()
      .then((data) => {
        set((state) => ({
          stats: data,
          loading: { ...state.loading, stats: false },
          apiError: false,
        }));
      })
      .catch((err) => {
        console.warn('Could not fetch stats overview:', err);
        set((state) => ({
          loading: { ...state.loading, stats: false },
          apiError: true,
          apiErrorMessage: 'Unable to connect to MuleShield HQ Server (Port 8000).',
        }));
      });

    // 2. Fetch Cases
    api.getCases()
      .then((data) => {
        set((state) => ({
          cases: data,
          loading: { ...state.loading, cases: false },
        }));
      })
      .catch((err) => {
        console.warn('Could not fetch cases:', err);
        set((state) => ({ loading: { ...state.loading, cases: false } }));
      });

    // 3. Fetch Active Alerts
    api.getActiveAlerts()
      .then((data) => {
        set((state) => ({
          alerts: data,
          loading: { ...state.loading, alerts: false },
        }));
      })
      .catch((err) => {
        console.warn('Could not fetch alerts:', err);
        set((state) => ({ loading: { ...state.loading, alerts: false } }));
      });

    // 4. Fetch Top Zones
    api.getTopZones(20)
      .then((data) => {
        set((state) => ({
          topZones: data,
          loading: { ...state.loading, zones: false },
        }));
      })
      .catch((err) => {
        console.warn('Could not fetch top zones:', err);
        set((state) => ({ loading: { ...state.loading, zones: false } }));
      });

    // 5. Fetch Grid GeoJSON for 3D Map
    api.getGridRisk()
      .then((data) => {
        set((state) => ({
          gridGeojson: data,
          loading: { ...state.loading, map: false },
        }));
      })
      .catch((err) => {
        console.warn('Could not fetch grid GeoJSON:', err);
        set((state) => ({ loading: { ...state.loading, map: false } }));
      });

    // 6. Fetch Trends & Hotspots
    Promise.allSettled([api.getStatsTrends(), api.getStatsHotspots()]).then(([trendsRes, hotspotsRes]) => {
      set((state) => ({
        trends: trendsRes.status === 'fulfilled' ? trendsRes.value : null,
        hotspots: hotspotsRes.status === 'fulfilled' ? hotspotsRes.value?.clusters || [] : [],
        loading: { ...state.loading, trends: false },
        lastSync: new Date().toISOString(),
      }));
    });
  },

  selectCase: async (caseId) => {
    try {
      const caseDetail = await api.getCaseDetail(caseId);
      set({ selectedCase: caseDetail });

      // Fly map to victim coordinates if present
      if (caseDetail.victim_info?.lat && caseDetail.victim_info?.lon) {
        set({
          mapTarget: {
            lat: caseDetail.victim_info.lat,
            lon: caseDetail.victim_info.lon,
            zoom: 11,
            pitch: 45,
          },
        });
      }
    } catch (err) {
      console.error('Error selecting case:', err);
      toast.error(`Failed to load case dossier: ${err.message}`);
    }
  },

  clearSelectedCase: () => set({ selectedCase: null }),

  handleWebSocketMessage: (msg) => {
    const { channel, payload } = msg;
    const now = new Date().toISOString();

    if (channel === 'NEW_ALERT') {
      const alert = payload;
      set((state) => {
        const exists = state.alerts.some((a) => a.alert_id === alert.alert_id);
        if (exists) return state;

        return {
          alerts: [alert, ...state.alerts],
          stats: {
            ...state.stats,
            active_alerts: state.stats.active_alerts + 1,
            total_amount_at_risk: state.stats.total_amount_at_risk + (alert.amount || 0),
          },
          lastSync: now,
        };
      });

      // High-priority Alert Notification
      toast.error(
        `CRITICAL ALERT: ₹${(alert.amount || 0).toLocaleString('en-IN')} at risk on account ${alert.account_id}!`,
        {
          duration: 5000,
          icon: '🚨',
          style: {
            background: '#111827',
            color: '#EF4444',
            border: '1px solid #EF4444',
            fontFamily: 'monospace',
          },
        }
      );
    } else if (channel === 'CASE_UPDATED') {
      const updatedCase = payload.case;
      if (updatedCase) {
        set((state) => ({
          cases: state.cases.some((c) => c.case_id === updatedCase.case_id)
            ? state.cases.map((c) => (c.case_id === updatedCase.case_id ? updatedCase : c))
            : [updatedCase, ...state.cases],
          selectedCase:
            state.selectedCase?.case_id === updatedCase.case_id ? updatedCase : state.selectedCase,
          stats: {
            ...state.stats,
            total_cases: state.cases.some((c) => c.case_id === updatedCase.case_id)
              ? state.stats.total_cases
              : state.stats.total_cases + 1,
          },
          lastSync: now,
        }));

        if (payload.action === 'CREATED') {
          toast.success(`New Case Registered: ${updatedCase.case_id}`, {
            style: { background: '#111827', color: '#F1F5F9', border: '1px solid #06B6D4' },
          });
        }
      }
    } else if (channel === 'FREEZE_APPROVED') {
      toast.success(`Bank Debit Freeze Authorized for ${payload.item?.account_id || 'Suspect'}`, {
        style: { background: '#111827', color: '#F1F5F9', border: '1px solid #10B981' },
      });
      // Refresh overview stats
      api.getStatsOverview().then((data) => set({ stats: data }));
    }
  },

  acknowledgeAlert: async (alertId, notes = '') => {
    try {
      const ackPayload = {
        acknowledged_by: 'Inspector (Cyber Cell HQ)',
        notes: notes || 'Field team alerted for ATM surveillance.',
      };
      const updated = await api.acknowledgeAlert(alertId, ackPayload);
      set((state) => ({
        alerts: state.alerts.filter((a) => a.alert_id !== alertId),
        stats: { ...state.stats, active_alerts: Math.max(0, state.stats.active_alerts - 1) },
      }));
      toast.success(`Alert ${alertId} acknowledged.`);
      return updated;
    } catch (err) {
      toast.error(`Failed to acknowledge alert: ${err.message}`);
    }
  },

  requestFreeze: async (freezeData) => {
    try {
      const res = await api.requestBankFreeze(freezeData);
      toast.success(`Freeze request submitted: ${res.freeze_reference_no}`);
      // Refresh stats
      api.getStatsOverview().then((data) => set({ stats: data }));
      return res;
    } catch (err) {
      toast.error(`Failed to request freeze: ${err.message}`);
    }
  },

  submitCaseFeedback: async (caseId, status, notes) => {
    try {
      const res = await api.submitCaseFeedback(caseId, {
        status,
        investigator_notes: notes,
        investigator_id: 'INVESTIGATOR_OFFICER_01',
      });
      set((state) => ({
        cases: state.cases.map((c) => (c.case_id === caseId ? res : c)),
        selectedCase: state.selectedCase?.case_id === caseId ? res : state.selectedCase,
      }));
      toast.success(`Case updated: marked as ${status}`);
      return res;
    } catch (err) {
      toast.error(`Failed to submit feedback: ${err.message}`);
    }
  },
}));
