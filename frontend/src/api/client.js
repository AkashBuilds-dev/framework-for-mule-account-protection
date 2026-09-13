/**
 * ==============================================================================
 * MuleShield (SIH26184) - API Client with Dynamic URL Resolution
 * ==============================================================================
 * Resolves API URL dynamically from window.location.hostname so each LAN
 * client connects to the HQ host that served the frontend.
 * ==============================================================================
 */

// ADDITION 1: Dynamic API Base URL
const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const errorBody = await response.text();
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const parsed = JSON.parse(errorBody);
        errorMsg = parsed.detail || errorMsg;
      } catch {
        // use raw text if not json
      }
      throw new Error(errorMsg);
    }
    return await response.json();
  } catch (error) {
    console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, error.message);
    throw error;
  }
}

// ------------------------------------------------------------------------------
// REST API Methods
// ------------------------------------------------------------------------------

export const api = {
  // System Health & Diagnostics
  getHealth: () => request('/api/health'),

  // KPIs & Analytics
  getStatsOverview: () => request('/api/stats/overview'),
  getStatsTrends: () => request('/api/stats/trends'),
  getStatsHotspots: () => request('/api/stats/hotspots'),
  getAuditLogs: (limit = 100) => request(`/api/audit/logs?limit=${limit}`),

  // Geospatial Grid & High-Risk Zones
  getGridRisk: () => request('/api/grid/risk'),
  getTopZones: (n = 20) => request(`/api/grid/top-zones?n=${n}`),

  // Case Management
  getCases: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/cases${query ? `?${query}` : ''}`);
  },
  getCaseDetail: (caseId) => request(`/api/cases/${caseId}`),
  createCase: (caseData) =>
    request('/api/cases/new', {
      method: 'POST',
      body: JSON.stringify(caseData),
    }),
  submitCaseFeedback: (caseId, feedback) =>
    request(`/api/cases/${caseId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(feedback),
    }),

  // Alerts & Crisis Escalation
  getActiveAlerts: () => request('/api/alerts/active'),
  getAlertDetail: (alertId) => request(`/api/alerts/${alertId}`),
  dispatchAlert: (alertData) =>
    request('/api/alerts/dispatch', {
      method: 'POST',
      body: JSON.stringify(alertData),
    }),
  acknowledgeAlert: (alertId, ackData) =>
    request(`/api/alerts/${alertId}/ack`, {
      method: 'POST',
      body: JSON.stringify(ackData),
    }),

  // Bank Debit Freezes (Section 102 CrPC)
  getFreezeQueue: (status) => {
    const query = status ? `?status=${status}` : '';
    return request(`/api/freeze/queue${query}`);
  },
  requestBankFreeze: (freezeData) =>
    request('/api/freeze/request', {
      method: 'POST',
      body: JSON.stringify(freezeData),
    }),
  actOnFreeze: (freezeId, actionData) =>
    request(`/api/freeze/${freezeId}/action`, {
      method: 'POST',
      body: JSON.stringify(actionData),
    }),

  // ML Predictions
  predictMule: (accountId) =>
    request('/api/predict/mule', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId }),
    }),
  predictCashout: (complaint) =>
    request('/api/predict/cashout', {
      method: 'POST',
      body: JSON.stringify(complaint),
    }),
  predictSyndicate: (accountId) =>
    request('/api/predict/syndicate', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId }),
    }),

  // Module G & Task 3: Bank, Admin & Model Drift Telemetry
  getBankStats: () => request('/api/stats/bank'),
  getBankWatchlist: () => request('/api/bank/watchlist'),
  getAdminStats: () => request('/api/stats/admin'),
  getModelMetrics: () => request('/api/models/metrics'),
  getModelDrift: () => request('/api/models/drift'),
  submitModelFeedback: (feedbackData) =>
    request('/api/models/feedback', {
      method: 'POST',
      body: JSON.stringify(feedbackData),
    }),
  getModelFeedback: () => request('/api/models/feedback'),
  retrainModel: () => request('/api/models/retrain', { method: 'POST' }),
  getUsers: () => request('/api/users'),
  // Module H: Escalation Matrix & SLA Dashboard
  escalateAlert: (alertId, data) =>
    request(`/api/alerts/${alertId}/escalate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAlertSLA: (alertId) => request(`/api/alerts/${alertId}/sla`),
  resolveAlert: (alertId, data) =>
    request(`/api/alerts/${alertId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSLADashboard: () => request('/api/alerts/sla/dashboard'),
  simulateCritical: () => request('/api/simulate/critical', { method: 'POST' }),
  // Module I: mobile field terminal
  getFieldOfficer: (officerId) => request(`/api/field/officer/${officerId}`),
  getFieldDispatches: (officerId) => request(`/api/field/dispatches?officer_id=${officerId}`),
  acceptFieldDispatch: (dispatchId) => request(`/api/field/dispatch/${dispatchId}/accept`, { method: 'POST' }),
  deferFieldDispatch: (dispatchId, reason) => request(`/api/field/dispatch/${dispatchId}/defer`, { method: 'POST', body: JSON.stringify({ reason }) }),
  arriveAtDispatch: (dispatchId) => request(`/api/field/dispatch/${dispatchId}/arrived`, { method: 'POST' }),
  submitFieldReport: (report) => request('/api/field/report', { method: 'POST', body: JSON.stringify(report) }),
  getFieldHistory: (officerId) => request(`/api/field/history?officer_id=${officerId}`),
};

// ------------------------------------------------------------------------------
// ADDITION 4: Live Fraud Simulation Generator
// ------------------------------------------------------------------------------
const CITIES = [
  { name: 'Mumbai', lat: 19.076, lon: 72.8777 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { name: 'Noida', lat: 28.5355, lon: 77.391 },
  { name: 'Gurugram', lat: 28.4595, lon: 77.0266 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Hyderabad', lat: 17.385, lon: 78.4867 },
  { name: 'Mewat', lat: 28.109, lon: 76.995 },
  { name: 'Jamtara', lat: 23.9625, lon: 86.8029 },
];

const VICTIM_NAMES = [
  'Vikram Malhotra',
  'Sunita Narang',
  'Rajesh Gokhale',
  'Dr. Ananya Sen',
  'Capt. Manoj Nair',
  'Priya Sundaram',
  'Kunal Singhania',
  'Ritu Saxena',
];

const FRAUD_TYPES = [
  'Digital Arrest / CBI Impersonation',
  'FedEx Narcotics Parcel Extortion',
  'Electricity Disconnection Threat',
  'Telegram Task Investment Scam',
  'UPI QR Code Impersonation',
  'Aadhaar Biometric KYC Leak',
];

const SUSPECT_ACCOUNTS = ['M00001', 'M00024', 'M00046', 'M00064', 'M00099', 'M00140', 'M00178'];

export async function simulateLiveFraud() {
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const victimName = VICTIM_NAMES[Math.floor(Math.random() * VICTIM_NAMES.length)];
  const fraudType = FRAUD_TYPES[Math.floor(Math.random() * FRAUD_TYPES.length)];
  const suspect = SUSPECT_ACCOUNTS[Math.floor(Math.random() * SUSPECT_ACCOUNTS.length)];

  // Randomized amount between ₹10,000 and ₹1,00,000 (rounded to nearest 500)
  const rawAmount = Math.floor(Math.random() * (100000 - 10000 + 1)) + 10000;
  const amount = Math.round(rawAmount / 500) * 500;

  const phone = `+91 ${Math.floor(Math.random() * 900000000 + 100000000)}`;

  const complaintPayload = {
    victim_name: victimName,
    victim_phone: phone,
    victim_city: city.name,
    victim_lat: city.lat + (Math.random() - 0.5) * 0.02,
    victim_lon: city.lon + (Math.random() - 0.5) * 0.02,
    suspect_account_id: suspect,
    fraud_type: fraudType,
    amount_lost: amount,
    complaint_notes: `Real-time cybercrime complaint flagged via citizen portal. Urgent withdrawal alert triggered.`,
  };

  return await api.createCase(complaintPayload);
}

/**
 * MODULE H: Live CRITICAL Escalation Simulation Trigger
 * Dispatches case with risk_score = 0.95 and amount = ₹75,000.
 * Triggers complete escalation cascade (auto freeze, SMS, call, field patrol dispatch, 5m SLA).
 */
export async function simulateCriticalAlert() {
  return await api.simulateCritical();
}

export default api;
