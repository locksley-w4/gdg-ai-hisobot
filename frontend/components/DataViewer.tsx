import React from 'react';
import { FinancialRecord } from '../types.ts';
import { Database, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface DataViewerProps {
  records: FinancialRecord[];
}

export const DataViewer: React.FC<DataViewerProps> = ({ records }) => {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Database className="w-12 h-12 mb-4 text-slate-300" />
        <p>No data in the repository yet. Upload a file to begin.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">PostgreSQL Data Store (Simulated)</h2>
          <p className="text-sm text-slate-500 mt-1">SCD Type 2 Versioning applied to all metrics.</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-slate-600 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
          <Clock className="w-4 h-4" />
          <span>Total Records: {records.length}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium">Key</th>
              <th className="p-4 font-medium">Value</th>
              <th className="p-4 font-medium">Version</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Source File</th>
              <th className="p-4 font-medium">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {records.map((record) => (
              <tr key={record.id} className={`hover:bg-slate-50 ${record.is_current ? 'bg-white' : 'bg-slate-50/50 text-slate-500'}`}>
                <td className="p-4 font-mono text-blue-600">{record.key}</td>
                <td className="p-4 font-medium">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(record.value)}
                </td>
                <td className="p-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                    v{record.version}
                  </span>
                </td>
                <td className="p-4">
                  {record.is_current ? (
                    <span className="inline-flex items-center text-green-600 text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Current
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-slate-400 text-xs font-medium">
                      <XCircle className="w-4 h-4 mr-1" /> Historical
                    </span>
                  )}
                </td>
                <td className="p-4 text-slate-500 truncate max-w-[150px]" title={record.source_file}>
                  {record.source_file}
                </td>
                <td className="p-4 text-slate-500 text-xs">
                  {new Date(record.timestamp).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
