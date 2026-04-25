import React, { useState, useCallback, useEffect } from 'react';
import { FinancialRecord, ExtractedMetric, TabType } from './types.ts';
import { FileUpload } from './components/FileUpload.tsx';
import { DataViewer } from './components/DataViewer.tsx';
import { TemplateDesigner } from './components/TemplateDesigner.tsx';
import { AuditorAnalyst } from './components/AuditorAnalyst.tsx';
import { ReportGenerator } from './components/ReportGenerator.tsx';
import { LayoutDashboard, Database, FileEdit, ShieldCheck, FileOutput, Lock } from 'lucide-react';

const DEFAULT_TEMPLATE = `Quarterly Financial Summary

Revenue Overview
----------------
Total Revenue for the period was {{total_revenue}}. 
Operating expenses amounted to {{operating_expenses}}, resulting in a Net Income of {{net_income}}.

Profitability Metrics
---------------------
EBITDA: {{ebitda}}
Gross Margin: {{gross_margin}}

Notes:
This report is automatically generated using the latest versioned data from the repository.`;

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [template, setTemplate] = useState<string>(DEFAULT_TEMPLATE);
  const [activeTab, setActiveTab] = useState<TabType>('etl');
  const [auditReport, setAuditReport] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('app_auth_token');
    if (!token) return;

    fetch('/auth/session', {
      method: 'GET',
      headers: {
        'X-App-Auth': token,
      },
    })
      .then((res) => {
        if (res.ok) {
          setIsAuthenticated(true);
          return;
        }
        sessionStorage.removeItem('app_auth_token');
      })
      .catch(() => {
        sessionStorage.removeItem('app_auth_token');
      });
  }, []);

  const handleDataExtracted = useCallback((newMetrics: ExtractedMetric[], filename: string) => {
    setRecords(prevRecords => {
      const updatedRecords = [...prevRecords];
      const timestamp = new Date().toISOString();

      newMetrics.forEach(metric => {
        // Find existing current record for this key
        const existingCurrentIndex = updatedRecords.findIndex(r => r.key === metric.key && r.is_current);
        let nextVersion = 1;

        if (existingCurrentIndex >= 0) {
          // Mark old record as historical
          updatedRecords[existingCurrentIndex] = {
            ...updatedRecords[existingCurrentIndex],
            is_current: false
          };
          nextVersion = updatedRecords[existingCurrentIndex].version + 1;
        }

        // Insert new current record
        const newId = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : Math.random().toString(36).substring(2) + Date.now().toString(36);

        updatedRecords.push({
          id: newId,
          key: metric.key,
          value: metric.value,
          version: nextVersion,
          is_current: true,
          timestamp,
          source_file: filename,
          editor_name: sessionStorage.getItem('app_auth_user') || 'Authenticated User'
        });
      });

      return updatedRecords;
    });
    
    setActiveTab('database');
    // Reset audit report when new data arrives so they are prompted to re-run
    setAuditReport(null);
  }, []);

  const tabs = [
    { id: 'etl', label: 'Ingestion & ETL', icon: LayoutDashboard },
    { id: 'database', label: 'Data Store (SCD2)', icon: Database },
    { id: 'template', label: 'Template Designer', icon: FileEdit },
    { id: 'auditor', label: 'AI Auditor', icon: ShieldCheck },
    { id: 'report', label: 'Generate Report', icon: FileOutput },
  ] as const;

  if (!isAuthenticated) {
    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setAuthError(null);
      setIsSigningIn(true);

      try {
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
          setAuthError('Invalid credentials. Please try again.');
          setIsSigningIn(false);
          return;
        }

        const data = await response.json();
        sessionStorage.setItem('app_auth_token', data.token);
        sessionStorage.setItem('app_auth_user', data.username || username);
        setIsAuthenticated(true);
      } catch (error) {
        setAuthError('Sign-in failed. Check backend connectivity and try again.');
      } finally {
        setIsSigningIn(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-sm w-full">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
              <Lock className="w-6 h-6" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">Login Required</h2>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your username"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your password"
                required
              />
            </div>
            {authError && <p className="text-sm text-red-600 mb-3">{authError}</p>}
            <button
              type="submit"
              disabled={isSigningIn}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              {isSigningIn ? 'Signing in...' : 'Access Platform'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-500 p-2 rounded-lg">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">Universal Financial Reporter</span>
            </div>
            <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              Frontend MVP Architecture
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="mb-8 border-b border-slate-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors
                    ${isActive 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
                  `}
                >
                  <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="animate-in fade-in duration-300">
          {activeTab === 'etl' && <FileUpload onDataExtracted={handleDataExtracted} />}
          {activeTab === 'database' && <DataViewer records={records} />}
          {activeTab === 'template' && (
            <TemplateDesigner 
              records={records} 
              template={template} 
              setTemplate={setTemplate} 
            />
          )}
          {activeTab === 'auditor' && (
            <AuditorAnalyst 
              records={records} 
              report={auditReport} 
              setReport={setAuditReport} 
            />
          )}
          {activeTab === 'report' && <ReportGenerator records={records} template={template} />}
        </div>
      </main>
    </div>
  );
}
