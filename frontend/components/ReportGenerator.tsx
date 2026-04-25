import React, { useEffect, useMemo, useState } from 'react';
import { FinancialRecord } from '../types.ts';
import { Download, FileOutput, Loader2, TrendingUp, BarChart3 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import * as html2canvasModule from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as markedModule from 'marked';

const html2canvas = html2canvasModule.default || html2canvasModule;
const marked = markedModule.marked || markedModule;
const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface ReportGeneratorProps {
  records: FinancialRecord[];
  template: string;
}

const priorityMetrics = ['total_revenue', 'net_income', 'operating_expenses', 'ebitda', 'gross_margin'];
const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const formatValueByKey = (key: string, value: number) => {
  if (key.includes('margin') || key.includes('ratio') || key.includes('percent')) {
    return `${value.toFixed(2)}%`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({ records, template }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [finalContentHtml, setFinalContentHtml] = useState('');

  const currentRecords = useMemo(() => records.filter((r) => r.is_current), [records]);

  const finalContent = useMemo(() => {
    let result = template;
    currentRecords.forEach((record) => {
      const regex = new RegExp(`{{${record.key}}}`, 'g');
      const val = Number(record.value) || 0;
      result = result.replace(regex, formatValueByKey(record.key, val));
    });
    return result;
  }, [template, currentRecords]);

  useEffect(() => {
    try {
      const parsed = marked.parse(finalContent);
      if (parsed instanceof Promise) {
        parsed.then(setFinalContentHtml);
      } else {
        setFinalContentHtml(parsed);
      }
    } catch (error) {
      console.error('Failed to parse markdown for report content', error);
      setFinalContentHtml(`<pre>${escapeHtml(finalContent)}</pre>`);
    }
  }, [finalContent]);

  const historyByKey = useMemo(() => {
    return records.reduce<Record<string, FinancialRecord[]>>((acc, record) => {
      if (!acc[record.key]) acc[record.key] = [];
      acc[record.key].push(record);
      return acc;
    }, {});
  }, [records]);

  const chartKeys = useMemo(() => {
    const keys = Array.from(new Set(currentRecords.map((r) => r.key)));
    return keys
      .sort((a, b) => {
        const indexA = priorityMetrics.indexOf(a);
        const indexB = priorityMetrics.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        const currentA = Math.abs(currentRecords.find((r) => r.key === a)?.value || 0);
        const currentB = Math.abs(currentRecords.find((r) => r.key === b)?.value || 0);
        return currentB - currentA;
      })
      .slice(0, 4);
  }, [currentRecords]);

  const timelineData = useMemo(() => {
    const byTimestamp = records.reduce<Record<string, Record<string, number | string>>>((acc, record) => {
      if (!acc[record.timestamp]) {
        acc[record.timestamp] = {
          timestamp: record.timestamp,
          name: new Date(record.timestamp).toLocaleDateString(),
        };
      }
      acc[record.timestamp][record.key] = Number(record.value) || 0;
      return acc;
    }, {});

    return Object.values(byTimestamp).sort((a, b) => {
      const t1 = new Date(String(a.timestamp)).getTime();
      const t2 = new Date(String(b.timestamp)).getTime();
      return t1 - t2;
    });
  }, [records]);

  const currentBarData = useMemo(() => {
    return chartKeys.map((key) => {
      const current = currentRecords.find((record) => record.key === key);
      const series = (historyByKey[key] || []).slice().sort((a, b) => b.version - a.version);
      const prev = series[1];
      const currentValue = Number(current?.value || 0);
      const previousValue = Number(prev?.value || 0);
      const delta = currentValue - previousValue;
      const deltaPct = previousValue !== 0 ? (delta / previousValue) * 100 : null;
      return {
        key,
        value: currentValue,
        previousValue,
        delta,
        deltaPct,
      };
    });
  }, [chartKeys, currentRecords, historyByKey]);

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById('report-content');
      if (!element) return;

      const generateCanvas = typeof html2canvas === 'function' ? html2canvas : (html2canvas as any).default;
      const canvas = await generateCanvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save('financial_report.pdf');
    } catch (error) {
      console.error('Failed to generate PDF', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center">
            <FileOutput className="w-6 h-6 text-emerald-600 mr-3" />
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Final Report Generation</h2>
              <p className="text-sm text-slate-600">Richer trend and delta insights with PDF export</p>
            </div>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={isExporting || records.length === 0}
            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {isExporting ? 'Generating...' : 'Export PDF'}
          </button>
        </div>

        <div className="p-8 bg-slate-200 flex justify-center overflow-x-auto">
          <div
            id="report-content"
            className="bg-white w-[210mm] min-h-[297mm] shadow-xl p-12 text-slate-800 border border-slate-300 flex flex-col"
          >
            <div className="border-b-2 border-slate-800 pb-6 mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Financial Report</h1>
                <p className="text-slate-500 mt-2 font-medium">Universal Financial Reporter</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Generated on</p>
                <p className="font-semibold text-slate-800">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {currentBarData.length > 0 && (
              <div className="grid grid-cols-2 gap-4 mb-8">
                {currentBarData.slice(0, 4).map((metric) => (
                  <div key={metric.key} className="border border-slate-200 rounded-lg p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{metric.key}</p>
                    <p className="text-xl font-semibold text-slate-800 mt-1">
                      {formatValueByKey(metric.key, metric.value)}
                    </p>
                    <p className={`text-xs mt-1 ${metric.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {metric.delta >= 0 ? 'Up' : 'Down'} {formatValueByKey(metric.key, Math.abs(metric.delta))}
                      {metric.deltaPct !== null ? ` (${metric.deltaPct >= 0 ? '+' : ''}${metric.deltaPct.toFixed(2)}%)` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div
              className="prose prose-slate max-w-none font-serif mb-10"
              dangerouslySetInnerHTML={{ __html: finalContentHtml }}
            />

            {timelineData.length > 0 && chartKeys.length > 0 && (
              <div className="pt-6 border-t border-slate-200">
                <div className="flex items-center mb-4">
                  <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
                  <h3 className="text-xl font-bold text-slate-800">Metric Trend Timeline</h3>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip
                        formatter={(value: number, name: string) => formatValueByKey(name, Number(value))}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      {chartKeys.map((key, index) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={colors[index % colors.length]}
                          strokeWidth={3}
                          activeDot={{ r: 6 }}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {currentBarData.length > 0 && (
              <div className="pt-8">
                <div className="flex items-center mb-4">
                  <BarChart3 className="w-5 h-5 text-indigo-600 mr-2" />
                  <h3 className="text-xl font-bold text-slate-800">Current Metric Comparison</h3>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentBarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="key" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip formatter={(value: number, name: string) => formatValueByKey(name, Number(value))} />
                      <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-center text-slate-400 mt-4 italic">
                  Chart and cards prioritize high-impact metrics and show movement from previous versions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
