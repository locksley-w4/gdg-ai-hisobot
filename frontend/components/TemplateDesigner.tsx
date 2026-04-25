import React, { useState, useMemo } from 'react';
import { FinancialRecord } from '../types.ts';
import { FileText, Code, ChevronDown, Save, Plus, Wand2, List, Search } from 'lucide-react';

interface TemplateDesignerProps {
  records: FinancialRecord[];
  template: string;
  setTemplate: (t: string) => void;
}

const DEFAULT_TEMPLATES: Record<string, string> = {
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
Profitability remains a core focus. With revenue at {{total_revenue}} and expenses at {{operating_expenses}}, the resulting margins indicate our current operational leverage.`,

  'Comprehensive Annual Report': `Annual Financial Performance Report

1. Top-Line Growth
------------------
The overall revenue achieved this year is {{total_revenue}}.

2. Expense Breakdown
--------------------
Our operating expenses were heavily managed, ending at {{operating_expenses}}.
Selling, General, and Administrative (SG&A) expenses: {{sga_expenses}}
Research and Development: {{rd_expenses}}

3. Bottom-Line Results
----------------------
Net Income: {{net_income}}
EBITDA: {{ebitda}}
Earnings Per Share (Basic): {{eps}}

4. Liquidity & Solvency
-----------------------
Cash & Cash Equivalents: {{cash_equivalents}}
Total Assets: {{total_assets}}
Total Liabilities: {{total_liabilities}}
Current Ratio: {{current_ratio}}

Executive Summary:
The organization maintained robust growth while improving the balance sheet leverage. Our strategic direction will continue focusing on maximizing {{ebitda}} and ensuring top-tier returns for our shareholders.`,
};

export const TemplateDesigner: React.FC<TemplateDesignerProps> = ({ records, template, setTemplate }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
  const [customTemplates, setCustomTemplates] = useState<Record<string, string>>({});
  const [templateName, setTemplateName] = useState('');
  const [searchField, setSearchField] = useState('');
  
  // For AI / Auto-fill mode
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  const currentRecords = useMemo(() => records.filter(r => r.is_current), [records]);
  const allAvailableKeys = useMemo(() => Array.from(new Set(currentRecords.map(r => r.key))), [currentRecords]);

  const filteredKeys = useMemo(() => {
    if (!searchField) return allAvailableKeys;
    return allAvailableKeys.filter(k => k.toLowerCase().includes(searchField.toLowerCase()));
  }, [allAvailableKeys, searchField]);

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

  const allTemplates = { ...DEFAULT_TEMPLATES, ...customTemplates };

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (allTemplates[selected]) {
      setTemplate(allTemplates[selected]);
      setTemplateName(selected);
    }
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      alert("Please enter a template name.");
      return;
    }
    setCustomTemplates(prev => ({ ...prev, [templateName]: template }));
    alert(`Template "${templateName}" saved!`);
  };

  const toggleFieldSelection = (key: string) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const generateAITemplate = () => {
    if (selectedFields.size === 0) {
      alert("Please select at least one field.");
      return;
    }
    let generated = "Auto-Generated Report\n=====================\n\nFollowing metrics outline the current financial status:\n\n";
    Array.from(selectedFields).forEach(field => {
      // Basic formatting of snake_case to Title Case
      const title = field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      generated += `- **${title}**: {{${field}}}\n`;
    });
    generated += "\n*This report focuses strictly on the selected KPIs and serves as an automated overview.*";
    
    setTemplate(generated);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-12rem)]">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Code className="w-5 h-5 text-blue-600 mr-2" />
              <h2 className="font-semibold text-slate-800">Template Editor</h2>
            </div>
            <div className="relative">
              <select 
                onChange={handleTemplateSelect}
                className="appearance-none bg-white border border-slate-300 text-slate-700 py-1.5 pl-3 pr-8 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
                value={Object.keys(allTemplates).includes(templateName) ? templateName : ""}
              >
                <option value="" disabled>Load a template...</option>
                <optgroup label="Default Templates">
                  {Object.keys(DEFAULT_TEMPLATES).map(key => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </optgroup>
                {Object.keys(customTemplates).length > 0 && (
                  <optgroup label="Custom Templates">
                    {Object.keys(customTemplates).map(key => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          
          <div className="flex items-center space-x-2 mb-2">
            <input 
              type="text" 
              placeholder="Template Name..." 
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="flex-grow px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <button 
              onClick={handleSaveTemplate}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-colors shadow-sm"
            >
              <Save className="w-4 h-4 mr-1" /> Save
            </button>
          </div>

          <div className="flex space-x-4 border-b border-slate-200 mt-2">
             <button 
                className={`py-2 px-1 text-sm font-medium border-b-2 flex items-center ${activeTab === 'manual' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveTab('manual')}
             >
                <Code className="w-4 h-4 mr-1" /> Manual
             </button>
             <button 
                className={`py-2 px-1 text-sm font-medium border-b-2 flex items-center ${activeTab === 'ai' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveTab('ai')}
             >
                <Wand2 className="w-4 h-4 mr-1" /> Auto-fill (AI)
             </button>
          </div>
        </div>

        <div className="p-4 flex-grow flex flex-col overflow-hidden">
          {activeTab === 'manual' && (
            <>
              <div className="mb-3 flex flex-wrap gap-2 overflow-y-auto max-h-24">
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
            </>
          )}

          {activeTab === 'ai' && (
            <div className="flex flex-col h-full">
              <p className="text-sm text-slate-600 mb-4">Choose the financial fields you want to highlight. An automated template will be generated instantly incorporating all these data points.</p>
              
              <div className="relative mb-4">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Search fields..."
                  value={searchField}
                  onChange={(e) => setSearchField(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex-grow overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50/50">
                {filteredKeys.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500 text-center">No fields found.</p>
                ) : (
                  filteredKeys.map(key => (
                    <label key={key} className="flex items-center p-2 hover:bg-slate-100 rounded cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={selectedFields.has(key)}
                        onChange={() => toggleFieldSelection(key)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-3 font-mono text-sm text-slate-700">{key}</span>
                    </label>
                  ))
                )}
              </div>

              <button 
                onClick={generateAITemplate}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center justify-center"
              >
                <Wand2 className="w-5 h-5 mr-2" /> Generate Template Details
              </button>
            </div>
          )}
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
