import React, { useState, useMemo } from 'react';
import { FinancialRecord } from '../types.ts';
import { Database, Clock, CheckCircle2, ChevronRight, ChevronDown, Search } from 'lucide-react';

interface DataViewerProps {
  records: FinancialRecord[];
}

export const DataViewer: React.FC<DataViewerProps> = ({ records }) => {
  const [search, setSearch] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const { latestRecords, groupedHistory } = useMemo(() => {
    const latest: FinancialRecord[] = [];
    const history: Record<string, FinancialRecord[]> = {};

    records.forEach(r => {
      if (r.is_current) latest.push(r);
      else {
        if (!history[r.key]) history[r.key] = [];
        history[r.key].push(r);
      }
    });

    // Sort history by version desc
    Object.values(history).forEach(list => list.sort((a, b) => b.version - a.version));
    
    return { latestRecords: latest, groupedHistory: history };
  }, [records]);

  const filteredLatest = useMemo(() => {
    if (!search) return latestRecords;
    const lower = search.toLowerCase();
    return latestRecords.filter(r => 
      r.key.toLowerCase().includes(lower) || 
      r.source_file.toLowerCase().includes(lower)
    );
  }, [search, latestRecords]);

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
      <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">PostgreSQL Data Store</h2>
          <p className="text-sm text-slate-500 mt-1">SCD Type 2 Versioning applied. Showing latest versions.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search records..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
          <div className="flex items-center space-x-2 text-sm text-slate-600 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
            <Clock className="w-4 h-4" />
            <span>Total Versions: {records.length}</span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium w-10"></th>
              <th className="p-4 font-medium">Key</th>
              <th className="p-4 font-medium">Value</th>
              <th className="p-4 font-medium">Version</th>
              <th className="p-4 font-medium">Editor</th>
              <th className="p-4 font-medium">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {filteredLatest.map((record) => {
              const isExpanded = expandedKeys.has(record.key);
              const historyList = groupedHistory[record.key] || [];
              const hasHistory = historyList.length > 0;

              return (
                <React.Fragment key={record.id}>
                  <tr 
                    className={`hover:bg-slate-50 bg-white ${hasHistory ? 'cursor-pointer' : ''}`}
                    onClick={() => hasHistory && toggleExpand(record.key)}
                  >
                    <td className="p-4 text-slate-400">
                      {hasHistory && (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                    </td>
                    <td className="p-4 font-mono text-blue-600 font-medium">
                      {record.key}
                      <span className="ml-2 inline-flex items-center text-green-600 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-50">
                         Current
                      </span>
                    </td>
                    <td className="p-4 font-medium text-slate-900">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(record.value)}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                        v{record.version}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">{record.editor_name || 'System'}</td>
                    <td className="p-4 text-slate-500 text-xs">{new Date(record.timestamp).toLocaleString()}</td>
                  </tr>

                  {isExpanded && historyList.map(hist => (
                    <tr key={hist.id} className="bg-slate-50/80 text-slate-500">
                      <td className="p-4"></td>
                      <td className="p-4 font-mono pl-8 text-slate-400 text-xs">└─ {hist.key}</td>
                      <td className="p-4 text-slate-500">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(hist.value)}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600">
                          v{hist.version}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500">{hist.editor_name || 'System'}</td>
                      <td className="p-4 text-slate-400 text-xs">{new Date(hist.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            
            {filteredLatest.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">No matching records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
