import React, { useState, useCallback } from 'react';
import { FinancialRecord, ExtractedMetric, TabType } from './types.ts';
import { FileUpload } from './components/FileUpload.tsx';
import { DataViewer } from './components/DataViewer.tsx';
import { TemplateDesigner } from './components/TemplateDesigner.tsx';
import { AuditorAnalyst } from './components/AuditorAnalyst.tsx';
import { ReportGenerator } from './components/ReportGenerator.tsx';
import { LayoutDashboard, Database, FileEdit, ShieldCheck, FileOutput } from 'lucide-react';

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
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [template, setTemplate] = useState<string>(DEFAULT_TEMPLATE);
  const [activeTab, setActiveTab] = useState<TabType>('etl');
  const [auditReport, setAuditReport] = useState<string | null>(null);

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
          source_file: filename
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
