import React, { useMemo } from 'react';
import { FinancialRecord } from '../types.ts';
import { FileText, Code, ChevronDown } from 'lucide-react';

interface TemplateDesignerProps {
  records: FinancialRecord[];
  template: string;
  setTemplate: (t: string) => void;
}

const DEFAULT_TEMPLATES = {
  'Quarterly Summary': `Quarterly Financial Summary

Revenue Overview
----------------
Total Revenue for the period was {{total_revenue}}. 
Operating expenses amounted to {{operating_expenses}}, resulting in a Net Income of {{net_income}}.

Profitability Metrics
---------------------
EBITDA: {{ebitda}}
Gross Margin: {{gross_margin}}

Notes:
This report is automatically generated using the latest versioned data from the repository.`,
  
  'Executive Brief': `Executive Briefing

Key Highlights:
- Topline Revenue: {{total_revenue}}
- Bottom Line (Net Income): {{net_income}}

Operational Efficiency:
Our operating expenses currently stand at {{operating_expenses}}. We are maintaining an EBITDA of {{ebitda}}.

Action Items:
Review margin sustainability given current gross margin of {{gross_margin}}.`,

  'Margin Analysis': `Margin & Profitability Analysis

Metrics:
- Gross Margin: {{gross_margin}}
- EBITDA: {{ebitda}}
- Net Income: {{net_income}}

Analysis:
Profitability remains a core focus. With revenue at {{total_revenue}} and expenses at {{operating_expenses}}, the resulting margins indicate our current operational leverage.`
};

export const TemplateDesigner: React.FC<TemplateDesignerProps> = ({ records, template, setTemplate }) => {
  const currentRecords = useMemo(() => records.filter(r => r.is_current), [records]);

  const previewContent = useMemo(() => {
    let result = template;
    currentRecords.forEach(record => {
      const regex = new RegExp(`{{${record.key}}}`, 'g');
      const formattedValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(record.value);
      result = result.replace(regex, formattedValue);
    });
    // Highlight unreplaced placeholders
    return result.replace(/{{(.*?)}}/g, '<span class="bg-red-100 text-red-800 px-1 rounded border border-red-200 font-mono text-xs">Missing: $1</span>');
  }, [template, currentRecords]);

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value as keyof typeof DEFAULT_TEMPLATES;
    if (DEFAULT_TEMPLATES[selected]) {
      setTemplate(DEFAULT_TEMPLATES[selected]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-12rem)]">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center">
            <Code className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="font-semibold text-slate-800">Template Editor</h2>
          </div>
          <div className="relative">
            <select 
              onChange={handleTemplateSelect}
              className="appearance-none bg-white border border-slate-300 text-slate-700 py-1.5 pl-3 pr-8 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
              defaultValue=""
            >
              <option value="" disabled>Load a template...</option>
              {Object.keys(DEFAULT_TEMPLATES).map(key => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div className="p-4 flex-grow flex flex-col">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 flex items-center">Available keys:</span>
            {currentRecords.length > 0 ? currentRecords.map(r => (
              <code key={r.key} className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600 text-xs border border-slate-200">
                {`{{${r.key}}}`}
              </code>
            )) : (
              <span className="text-xs text-slate-400 italic">No data uploaded yet</span>
            )}
          </div>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="flex-grow w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none shadow-inner"
            placeholder="Write your report template here..."
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center">
          <FileText className="w-5 h-5 text-green-600 mr-2" />
          <h2 className="font-semibold text-slate-800">Live Preview</h2>
        </div>
        <div className="p-8 flex-grow overflow-y-auto bg-slate-50/50">
          <div 
            className="prose prose-slate max-w-none whitespace-pre-wrap font-serif bg-white p-8 shadow-sm border border-slate-200 min-h-full"
            dangerouslySetInnerHTML={{ __html: previewContent }}
          />
        </div>
      </div>
    </div>
  );
};
