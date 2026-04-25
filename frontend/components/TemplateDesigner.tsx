import React, { useMemo, useState } from 'react';
import { FinancialRecord } from '../types.ts';
import { FileText, Code, ChevronDown, Save, Sparkles, Search, ListFilter } from 'lucide-react';
import { generateTemplateFromFields } from '../services/geminiService.ts';

interface TemplateDesignerProps {
  records: FinancialRecord[];
  template: string;
  setTemplate: (t: string) => void;
}

interface SavedTemplate {
  name: string;
  content: string;
  createdAt: string;
  source: 'manual' | 'ai';
}

const SAVED_TEMPLATES_STORAGE_KEY = 'saved_report_templates_v1';

const DEFAULT_TEMPLATES: Record<string, string> = {
  'Board Pack Narrative': `Quarterly Board Financial Narrative

1. Executive Overview
- Total Revenue: {{total_revenue}}
- Net Income: {{net_income}}
- EBITDA: {{ebitda}}
- Gross Margin: {{gross_margin}}

2. Performance Assessment
Current operating expenses are {{operating_expenses}}. Compare this with topline and margin behavior to evaluate operational efficiency.

3. Material Risks
- Review abrupt metric shifts against previous versions.
- Validate that profit and margin trends align with revenue movement.
- Investigate any deterioration between EBITDA and net income trajectories.

4. Management Actions
- Confirm root causes for negative deltas.
- Prioritize corrective actions for cost-intensive lines.
- Define target outcomes for next cycle.`,
  'CFO Deep Dive': `CFO Deep-Dive Template

Headline Metrics:
- Revenue: {{total_revenue}}
- Operating Expenses: {{operating_expenses}}
- Net Income: {{net_income}}
- EBITDA: {{ebitda}}
- Gross Margin: {{gross_margin}}

Detailed Commentary:
Use this section to explain drivers behind the current quarter. Highlight operational constraints, cost-optimization actions, and liquidity impacts.

Trend Interpretation:
Discuss how current values compare to previous versions and why the direction matters for the next reporting period.

Forward View:
- Key exposure areas
- Recovery levers
- Priority control checks`,
  'Investor Update': `Investor Update

Snapshot:
- Revenue delivered: {{total_revenue}}
- Net result: {{net_income}}
- EBITDA level: {{ebitda}}
- Margin profile: {{gross_margin}}

Operating Context:
The company recorded operating expenses of {{operating_expenses}}. Explain scale effects, efficiency trajectory, and any one-off impacts.

Strategic Notes:
- What improved since the previous version
- What degraded and why
- What management will execute next`,
};

export const TemplateDesigner: React.FC<TemplateDesignerProps> = ({ records, template, setTemplate }) => {
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [fieldSearch, setFieldSearch] = useState('');
  const [interestingOnly, setInterestingOnly] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_TEMPLATES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const currentRecords = useMemo(() => records.filter((r) => r.is_current), [records]);

  const availableFields = useMemo(() => {
    return Array.from(new Set(currentRecords.map((r) => r.key))).sort();
  }, [currentRecords]);

  const interestingKeywords = ['revenue', 'income', 'profit', 'margin', 'ebitda', 'expense', 'cash', 'debt', 'growth'];
  const filteredFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    return availableFields.filter((field) => {
      if (interestingOnly && !interestingKeywords.some((keyword) => field.toLowerCase().includes(keyword))) {
        return false;
      }
      if (!q) return true;
      return field.toLowerCase().includes(q);
    });
  }, [availableFields, fieldSearch, interestingOnly]);

  const previewContent = useMemo(() => {
    let result = template;
    currentRecords.forEach((record) => {
      const regex = new RegExp(`{{${record.key}}}`, 'g');
      const formattedValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(record.value);
      result = result.replace(regex, formattedValue);
    });
    return result.replace(
      /{{(.*?)}}/g,
      '<span class="bg-red-100 text-red-800 px-1 rounded border border-red-200 font-mono text-xs">Missing: $1</span>',
    );
  }, [template, currentRecords]);

  const persistSavedTemplates = (next: SavedTemplate[]) => {
    setSavedTemplates(next);
    localStorage.setItem(SAVED_TEMPLATES_STORAGE_KEY, JSON.stringify(next));
  };

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (!selected) return;

    if (DEFAULT_TEMPLATES[selected]) {
      setTemplate(DEFAULT_TEMPLATES[selected]);
      return;
    }

    const fromSaved = savedTemplates.find((item) => item.name === selected);
    if (fromSaved) {
      setTemplate(fromSaved.content);
    }
  };

  const handleToggleField = (field: string) => {
    setSelectedFields((prev) => (prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]));
  };

  const handleSelectAllFilteredFields = () => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      filteredFields.forEach((field) => next.add(field));
      return Array.from(next);
    });
  };

  const handleClearFilteredFields = () => {
    setSelectedFields((prev) => prev.filter((field) => !filteredFields.includes(field)));
  };

  const handleGenerateFromAI = async () => {
    if (selectedFields.length === 0) {
      setSaveError('Select at least one field for AI auto-fill.');
      return;
    }

    setSaveError(null);
    setIsGenerating(true);
    try {
      const generated = await generateTemplateFromFields(selectedFields);
      setTemplate(generated);
      setMode('manual');
    } catch (error) {
      if (error instanceof Error) {
        setSaveError(error.message);
      } else {
        setSaveError('Failed to auto-generate template.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveTemplate = () => {
    const cleanName = templateName.trim();
    if (!cleanName) {
      setSaveError('Template name is required.');
      return;
    }
    if (!template.trim()) {
      setSaveError('Template content is empty.');
      return;
    }

    const nextTemplate: SavedTemplate = {
      name: cleanName,
      content: template,
      createdAt: new Date().toISOString(),
      source: mode,
    };

    const deduped = savedTemplates.filter((item) => item.name !== cleanName);
    persistSavedTemplates([nextTemplate, ...deduped]);
    setSaveError(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-12rem)]">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Code className="w-5 h-5 text-blue-600 mr-2" />
              <h2 className="font-semibold text-slate-800">Template Builder</h2>
            </div>
            <div className="relative">
              <select
                onChange={handleTemplateSelect}
                className="appearance-none bg-white border border-slate-300 text-slate-700 py-1.5 pl-3 pr-8 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Load template...
                </option>
                {Object.keys(DEFAULT_TEMPLATES).map((key) => (
                  <option key={key} value={key}>
                    Default: {key}
                  </option>
                ))}
                {savedTemplates.map((item) => (
                  <option key={item.name} value={item.name}>
                    Saved: {item.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('manual')}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                mode === 'manual'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Manual
            </button>
            <button
              onClick={() => setMode('ai')}
              className={`px-3 py-1.5 text-sm rounded-md border flex items-center ${
                mode === 'ai'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-4 h-4 mr-1" /> AI Auto-fill
            </button>
          </div>
        </div>

        <div className="p-4 flex-grow flex flex-col gap-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Template Name</label>
            <div className="flex gap-2">
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Monthly CFO Pack"
                className="flex-grow px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSaveTemplate}
                className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-900 flex items-center"
              >
                <Save className="w-4 h-4 mr-1" /> Save
              </button>
            </div>
          </div>

          {mode === 'ai' && (
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="relative flex-grow">
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    placeholder="Search fields..."
                    className="w-full pl-8 pr-2 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <label className="text-xs text-slate-700 flex items-center whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={interestingOnly}
                    onChange={(e) => setInterestingOnly(e.target.checked)}
                    className="mr-1.5 rounded border-slate-300"
                  />
                  <ListFilter className="w-3.5 h-3.5 mr-1" /> Interesting only
                </label>
              </div>
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-md bg-white p-2">
                <div className="flex items-center justify-end gap-2 pb-2 mb-2 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={handleSelectAllFilteredFields}
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFilteredFields}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Clear
                  </button>
                </div>
                {filteredFields.length > 0 ? (
                  filteredFields.map((field) => (
                    <label key={field} className="flex items-center text-sm text-slate-700 py-1">
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(field)}
                        onChange={() => handleToggleField(field)}
                        className="mr-2 rounded border-slate-300"
                      />
                      <span className="font-mono text-xs">{`{{${field}}}`}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No fields available for current filter.</p>
                )}
              </div>
              <button
                onClick={handleGenerateFromAI}
                disabled={isGenerating || selectedFields.length === 0}
                className="mt-3 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center"
              >
                <Sparkles className={`w-4 h-4 mr-1 ${isGenerating ? 'animate-pulse' : ''}`} />
                {isGenerating ? 'Generating...' : 'Generate from selected fields'}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 flex items-center">Available keys:</span>
            {currentRecords.length > 0 ? (
              currentRecords.map((r) => (
                <code key={r.key} className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600 text-xs border border-slate-200">
                  {`{{${r.key}}}`}
                </code>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">No data uploaded yet</span>
            )}
          </div>

          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="flex-grow w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none shadow-inner min-h-[280px]"
            placeholder="Write your report template here..."
          />
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
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
