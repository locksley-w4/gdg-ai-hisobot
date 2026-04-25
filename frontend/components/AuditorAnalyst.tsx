import React, { useState, useEffect } from 'react';
import { FinancialRecord } from '../types.ts';
import { generateAuditReport } from '../services/geminiService.ts';
import { ShieldAlert, Sparkles, Loader2, Globe } from 'lucide-react';
import * as markedModule from 'marked';

// Handle ESM default export variations
const marked = markedModule.marked || markedModule;

interface AuditorAnalystProps {
  records: FinancialRecord[];
  report: string | null;
  setReport: (report: string | null) => void;
}

export const AuditorAnalyst: React.FC<AuditorAnalystProps> = ({ records, report, setReport }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [language, setLanguage] = useState<'english' | 'russian'>('english');

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const currentData = records.filter(r => r.is_current);
      const historicalData = records.filter(r => !r.is_current);
      const result = await generateAuditReport(currentData, historicalData, language);
      setReport(result);
    } catch (error) {
      console.error("Analysis failed", error);
      setReport("Failed to generate analysis. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Re-run if we hold a report but they changed language (optional, but a good touch)
  // For safety, let's just make them click run audit again.

  useEffect(() => {
    if (!report) {
      setHtmlContent('');
      return;
    }
    try {
      const parsed = marked.parse(report);
      if (parsed instanceof Promise) {
        parsed.then(setHtmlContent);
      } else {
        setHtmlContent(parsed);
      }
    } catch (e) {
      console.error("Marked parse error", e);
      // Fallback to raw text if parsing fails
      setHtmlContent(`<p>${report}</p>`);
    }
  }, [report]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-blue-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center">
            <ShieldAlert className="w-6 h-6 text-indigo-600 mr-3" />
            <div>
              <h2 className="text-lg font-semibold text-slate-800">AI Auditor & Analyst</h2>
              <p className="text-sm text-slate-600">Powered by Gemini AI Model</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center bg-white px-2 py-1 rounded-md border border-slate-300 shadow-sm text-sm">
                <Globe className="w-4 h-4 text-slate-400 mr-2" />
                <select 
                  className="bg-transparent border-none outline-none focus:ring-0 text-slate-600 font-medium cursor-pointer"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'english' | 'russian')}
                >
                  <option value="english">English</option>
                  <option value="russian">Русский</option>
                </select>
             </div>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || records.length === 0}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {isAnalyzing ? 'Analyzing...' : (report ? 'Re-run Audit' : 'Run Audit')}
            </button>
          </div>
        </div>

        <div className="p-8 min-h-[400px] bg-slate-50">
          {!report && !isAnalyzing && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 pt-12">
              <Sparkles className="w-12 h-12 mb-4 opacity-20" />
              <p>Click "Run Audit" to scan data for anomalies and generate insights.</p>
              {records.length === 0 && (
                <p className="text-sm mt-2 text-amber-600">Please upload data in the ETL tab first.</p>
              )}
            </div>
          )}

          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center h-full text-indigo-500 pt-12">
              <Loader2 className="w-12 h-12 mb-4 animate-spin" />
              <p className="animate-pulse font-medium">Cross-referencing historical versions...</p>
              <p className="text-sm text-indigo-400 mt-2">Analyzing mathematical consistency and trends.</p>
            </div>
          )}

          {report && !isAnalyzing && (
            <div 
              className="prose prose-indigo prose-slate max-w-none bg-white p-8 rounded-xl shadow-sm border border-slate-100"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
