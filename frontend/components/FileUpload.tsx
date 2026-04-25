import React, { useState, useCallback } from 'react';
import { UploadCloud, Loader2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { extractFinancialData } from '../services/geminiService.ts';
import { ExtractedMetric } from '../types.ts';

interface FileUploadProps {
  onDataExtracted: (data: ExtractedMetric[], filename: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataExtracted }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const csvData = XLSX.utils.sheet_to_csv(worksheet);

      if (!csvData || csvData.trim() === '') {
        throw new Error("The uploaded file appears to be empty or unreadable.");
      }

      const extractedMetrics = await extractFinancialData(csvData);
      if (extractedMetrics.length === 0) {
        throw new Error("AI could not extract any valid financial metrics from this file.");
      }

      onDataExtracted(extractedMetrics, file.name);
    } catch (err: any) {
      setError(err.message || "An error occurred while processing the file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Dynamic ETL & Mapping</h2>
        <p className="text-slate-600 mb-6 text-sm">
          Upload an Excel (.xlsx) or CSV file. Our Vertex AI agent will intelligently map varied structures into a standardized key-value format.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 bg-slate-50'
          }`}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-slate-600 font-medium">AI is analyzing and mapping data...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-white rounded-full shadow-sm">
                <UploadCloud className="w-8 h-8 text-blue-500" />
              </div>
              <div>
                <p className="text-slate-700 font-medium">Drag & drop your financial report here</p>
                <p className="text-slate-500 text-sm mt-1">or click to browse files</p>
              </div>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors font-medium text-sm"
              >
                Select File
              </label>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100 flex items-start">
            <FileSpreadsheet className="w-5 h-5 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};
