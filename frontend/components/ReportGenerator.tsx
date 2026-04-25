import React, { useMemo, useState } from 'react';
import { FinancialRecord } from '../types.ts';
import { Download, FileOutput, Loader2, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as html2canvasModule from 'html2canvas';
import { jsPDF } from 'jspdf';

// Handle ESM default export variations
const html2canvas = html2canvasModule.default || html2canvasModule;

interface ReportGeneratorProps {
  records: FinancialRecord[];
  template: string;
}

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({ records, template }) => {
  const [isExporting, setIsExporting] = useState(false);

  const currentRecords = useMemo(() => records.filter(r => r.is_current), [records]);

  const finalContent = useMemo(() => {
    let result = template;
    currentRecords.forEach(record => {
      const regex = new RegExp(`{{${record.key}}}`, 'g');
      const val = Number(record.value) || 0;
      const formattedValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
      result = result.replace(regex, formattedValue);
    });
    return result;
  }, [template, currentRecords]);

  // Prepare data for charts (group by version)
  const chartData = useMemo(() => {
    if (records.length === 0) return [];
    
    const versions = Array.from(new Set(records.map(r => r.version))).sort((a, b) => a - b);
    return versions.map(v => {
      const dataPoint: any = { name: `v${v}` };
      records.filter(r => r.version === v).forEach(r => {
        dataPoint[r.key] = Number(r.value) || 0;
      });
      return dataPoint;
    });
  }, [records]);

  // Get top 3 keys to display in the chart to avoid clutter
  const topKeys = useMemo(() => {
    const keys = Array.from(new Set(records.map(r => r.key)));
    // Prioritize common important metrics if they exist
    const priority = ['total_revenue', 'net_income', 'operating_expenses', 'ebitda'];
    return keys.sort((a, b) => {
      const indexA = priority.indexOf(a);
      const indexB = priority.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    }).slice(0, 3);
  }, [records]);

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById('report-content');
      if (!element) return;

      // Use the resolved html2canvas function
      const generateCanvas = typeof html2canvas === 'function' ? html2canvas : (html2canvas as any).default;
      
      const canvas = await generateCanvas(element, {
        scale: 2, // Higher resolution
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('financial_report.pdf');
    } catch (error) {
      console.error("Failed to generate PDF", error);
      alert("Failed to generate PDF. Please try again.");
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
              <p className="text-sm text-slate-600">Review rich dashboard and export to PDF</p>
            </div>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={isExporting || records.length === 0}
            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {isExporting ? 'Generating...' : 'Export PDF'}
          </button>
        </div>
        
        <div className="p-8 bg-slate-200 flex justify-center overflow-x-auto">
          {/* The actual report content to be captured by html2canvas */}
          <div 
            id="report-content" 
            className="bg-white w-[210mm] min-h-[297mm] shadow-xl p-12 text-slate-800 border border-slate-300 flex flex-col"
          >
            {/* Header */}
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

            {/* Text Content */}
            <div className="prose prose-slate max-w-none whitespace-pre-wrap font-serif mb-12">
              {finalContent}
            </div>

            {/* Visualizations */}
            {chartData.length > 0 && (
              <div className="mt-auto pt-8 border-t border-slate-200">
                <div className="flex items-center mb-6">
                  <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
                  <h3 className="text-xl font-bold text-slate-800">Historical Trends (SCD Type 2)</h3>
                </div>
                
                <div className="grid grid-cols-1 gap-8">
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#64748b" />
                        <YAxis stroke="#64748b" tickFormatter={(value) => `$${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`} />
                        <Tooltip 
                          formatter={(value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        {topKeys.map((key, index) => (
                          <Line 
                            key={key} 
                            type="monotone" 
                            dataKey={key} 
                            stroke={colors[index % colors.length]} 
                            strokeWidth={3}
                            activeDot={{ r: 8 }} 
                            isAnimationActive={false} /* Disabled animation for reliable html2canvas capture */
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <p className="text-xs text-center text-slate-400 mt-6 italic">
                  * Chart displays the top {topKeys.length} metrics across historical versions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
