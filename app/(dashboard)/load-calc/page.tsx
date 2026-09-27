'use client';

import React, { useState } from 'react';
import { Gauge, Download, Calendar, Layers, CheckCircle2 } from 'lucide-react';
import { API_BASE } from '@/lib/constants';

export default function LoadCalculationPage() {
  const [activeTab, setActiveTab] = useState<'detailed' | 'summary'>('detailed');
  const [startMonth, setStartMonth] = useState('2026-07');

  const downloadLoadExcel = (type: 'detailed' | 'summary') => {
    const token = localStorage.getItem('token');
    window.open(`${API_BASE}/api/orders/load-download/${type}?startMonth=${startMonth}&token=${token}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" />
            5-Month Capacity & Load Forecasting
          </h2>
          <p className="text-xs text-base-content/60">
            Project pending machine allocations and departmental load requirements across a 5-month rolling window.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="tabs tabs-boxed bg-base-100 p-1 border border-base-300">
          <button
            onClick={() => setActiveTab('detailed')}
            className={`tab tab-sm font-bold ${activeTab === 'detailed' ? 'tab-active !bg-primary text-primary-content' : ''}`}
          >
            Detailed Load Download
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`tab tab-sm font-bold ${activeTab === 'summary' ? 'tab-active !bg-primary text-primary-content' : ''}`}
          >
            Buyer-wise Summary
          </button>
        </div>
      </div>

      {/* Control Card */}
      <div className="card bg-base-100 border border-base-300 p-6 shadow-sm">
        <div className="max-w-xl space-y-4">
          <h3 className="font-bold text-sm">Select Rolling 5-Month Projection Window</h3>
          
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="input input-bordered input-sm"
            />
          </div>

          <p className="text-xs text-base-content/60">
            The load calculation engine extracts pending production quantities (Knit Balance, Dyeing Balance, Delivery Balance) and maps them across the 5 upcoming calendar months.
          </p>

          <div className="pt-2">
            <button
              onClick={() => downloadLoadExcel(activeTab)}
              className="btn btn-primary btn-sm font-bold shadow-md shadow-primary/25"
            >
              <Download className="w-4 h-4 mr-1" />
              Download {activeTab === 'detailed' ? 'Item-Level Detailed' : 'Buyer-Wise Summary'} Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
