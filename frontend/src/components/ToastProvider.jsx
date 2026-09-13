/**
 * ==============================================================================
 * MuleShield (SIH26184) - Dark Forensic Toast Notifications Provider
 * ==============================================================================
 * Configures react-hot-toast to match the deep navy and slate tactical palette.
 * ==============================================================================
 */

import React from 'react';
import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        className: 'font-sans text-xs shadow-2xl',
        duration: 4000,
        style: {
          background: '#111827',
          color: '#F1F5F9',
          border: '1px solid #1F2937',
          padding: '12px 16px',
          borderRadius: '8px',
        },
        success: {
          iconTheme: {
            primary: '#10B981',
            secondary: '#111827',
          },
        },
        error: {
          iconTheme: {
            primary: '#EF4444',
            secondary: '#111827',
          },
        },
      }}
    />
  );
}
