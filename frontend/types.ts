export interface FinancialRecord {
  id: string;
  key: string;
  value: number;
  version: number;
  is_current: boolean;
  timestamp: string;
  source_file: string;
}

export interface ExtractedMetric {
  key: string;
  value: number;
}

export type TabType = 'etl' | 'database' | 'template' | 'auditor' | 'report';
