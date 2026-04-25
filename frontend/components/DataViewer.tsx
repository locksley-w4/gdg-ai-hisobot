import React, { useMemo, useState } from 'react';
import { FinancialRecord } from '../types.ts';
import { Database, Clock, CheckCircle2, Search, ChevronDown, ChevronRight, History } from 'lucide-react';

interface DataViewerProps {
  records: FinancialRecord[];
}

export const DataViewer: React.FC<DataViewerProps> = ({ records }) => {
  const [search, setSearch] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const historyByKey = useMemo(() => {
    return records.reduce<Record<string, FinancialRecord[]>>((acc, record) => {
      if (!acc[record.key]) acc[record.key] = [];
      acc[record.key].push(record);
      return acc;
    }, {});
  }, [records]);

  const latestRecords = useMemo(() => {
    return Object.values(historyByKey)
      .map((entry) =>
        entry
          .slice()
          .sort((a, b) => {
            if (b.version !== a.version) return b.version - a.version;
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          })[0],
      )
      .filter((record): record is FinancialRecord => Boolean(record));
  }, [historyByKey]);

  const filteredLatestRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return latestRecords;
    return latestRecords.filter((record) => {
      return (
        record.key.toLowerCase().includes(q) ||
        record.source_file.toLowerCase().includes(q) ||
        (record.editor_name || '').toLowerCase().includes(q)
      );
    });
  }, [latestRecords, search]);

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
          <p className="text-sm text-slate-500 mt-1">Latest version per key is shown. Click a row to inspect full history.</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-slate-600 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
          <Clock className="w-4 h-4" />
          <span>Total Rows: {records.length} | Latest Keys: {latestRecords.length}</span>
        </div>
      </div>
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by key, source file, or editor..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium"></th>
              <th className="p-4 font-medium">Key</th>
              <th className="p-4 font-medium">Latest Value</th>
              <th className="p-4 font-medium">Latest Version</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Source File</th>
              <th className="p-4 font-medium">Editor</th>
              <th className="p-4 font-medium">Updated At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {filteredLatestRecords.map((record) => {
              const history = (historyByKey[record.key] || [])
                .slice()
                .sort((a, b) => {
                  if (b.version !== a.version) return b.version - a.version;
                  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                });
              const isExpanded = expandedKey === record.key;

              return (
                <React.Fragment key={record.id}>
                  <tr
                    className="hover:bg-slate-50 bg-white cursor-pointer"
                    onClick={() => setExpandedKey((prev) => (prev === record.key ? null : record.key))}
                  >
                    <td className="p-4 text-slate-500">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
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
                      <span className="inline-flex items-center text-green-600 text-xs font-medium">
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Current
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 truncate max-w-[150px]" title={record.source_file}>
                      {record.source_file}
                    </td>
                    <td className="p-4 text-slate-500">{record.editor_name || 'system'}</td>
                    <td className="p-4 text-slate-500 text-xs">{new Date(record.timestamp).toLocaleString()}</td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="p-4 bg-slate-50">
                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                          <div className="px-4 py-2 bg-slate-100 text-xs text-slate-700 font-medium flex items-center">
                            <History className="w-4 h-4 mr-2" />
                            Full Version History for <span className="font-mono ml-1">{record.key}</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                                <tr>
                                  <th className="px-4 py-2">Version</th>
                                  <th className="px-4 py-2">Value</th>
                                  <th className="px-4 py-2">Editor</th>
                                  <th className="px-4 py-2">Date</th>
                                  <th className="px-4 py-2">Source</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {history.map((item) => (
                                  <tr key={item.id} className={item.is_current ? 'bg-emerald-50/30' : 'bg-white'}>
                                    <td className="px-4 py-2 font-medium text-slate-700">v{item.version}</td>
                                    <td className="px-4 py-2">
                                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.value)}
                                    </td>
                                    <td className="px-4 py-2 text-slate-600">{item.editor_name || 'system'}</td>
                                    <td className="px-4 py-2 text-slate-600">{new Date(item.timestamp).toLocaleString()}</td>
                                    <td className="px-4 py-2 text-slate-500 truncate max-w-[220px]" title={item.source_file}>
                                      {item.source_file}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filteredLatestRecords.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  No records match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
