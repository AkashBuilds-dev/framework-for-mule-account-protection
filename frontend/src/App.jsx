/**
 * ==============================================================================
 * MuleShield (SIH26184) - Main Application Shell & Multi-Portal Router
 * ==============================================================================
 * - /       → Investigator Dashboard (Flagship 3D GIS & Entity Resolution)
 * - /bank   → Bank Officer Dashboard (Section 102 CrPC Debit Freeze Console)
 * - /admin  → Admin Console (I4C HQ ML Ops, Drift Telemetry & Audit Trail)
 * ==============================================================================
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import InvestigatorDashboard from './pages/InvestigatorDashboard';
import BankDashboard from './pages/BankDashboard';
import AdminConsole from './pages/AdminConsole';
import FieldApp from './pages/FieldApp';
import ErrorBoundary from './components/ErrorBoundary';
import ToastProvider from './components/ToastProvider';
import { useAppStore } from './store/appStore';
import { wsManager } from './api/websocket';

// Preserved Flagship Investigator Layout (100% Pixel-Identical)
function InvestigatorLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#F1F5F9] flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Fixed 64px Command TopBar */}
      <TopBar />

      {/* Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Collapsible Navigation Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Scrollable Dashboard Viewport */}
        <main className="flex-1 overflow-y-auto bg-[#0A0E1A]">
          <InvestigatorDashboard activeTab={activeTab} />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { fetchInitialData, handleWebSocketMessage, setWsStatus } = useAppStore();

  useEffect(() => {
    // 1. Initial Load of Cases, Alerts, Grid, and Analytics
    fetchInitialData();

    // 2. Bind Central WebSocket Manager
    const unsubscribeMessages = wsManager.subscribe((msg) => {
      handleWebSocketMessage(msg);
    });

    const unsubscribeStatus = wsManager.subscribeStatus((status) => {
      setWsStatus(status);
    });

    wsManager.connect();

    return () => {
      unsubscribeMessages();
      unsubscribeStatus();
      wsManager.disconnect();
    };
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<InvestigatorLayout />} />
          <Route path="/bank" element={<BankDashboard />} />
          <Route path="/admin" element={<AdminConsole />} />
          <Route path="/field" element={<FieldApp />} />
        </Routes>

        {/* Global Toast Notifications */}
        <ToastProvider />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
