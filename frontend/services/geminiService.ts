import { GoogleGenAI, Type } from '@google/genai';
import { ExtractedMetric, FinancialRecord } from '../types.ts';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });

const KNOWN_KEY_ALIASES: Record<string, string> = {
  revenue: 'total_revenue',
  total_revenue: 'total_revenue',
  sales: 'total_revenue',
  net_income: 'net_income',
  net_profit: 'net_income',
  profit: 'net_income',
  operating_expenses: 'operating_expenses',
  expenses: 'operating_expenses',
  opex: 'operating_expenses',
  ebitda: 'ebitda',
  gross_margin: 'gross_margin',
  margin: 'gross_margin',
};

const normalizeKey = (raw: string): string => {
  const base = raw
    .toLowerCase()
    .replace(/[%$]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
  return KNOWN_KEY_ALIASES[base] || base;
};

const buildUniqueKey = (baseKey: string, used: Set<string>): string => {
  const cleanBase = normalizeKey(baseKey) || 'metric';
  if (!used.has(cleanBase)) {
    used.add(cleanBase);
    return cleanBase;
  }
  let i = 2;
  while (used.has(`${cleanBase}_${i}`)) {
    i += 1;
  }
  const next = `${cleanBase}_${i}`;
  used.add(next);
  return next;
};

const parseNumberish = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const isPercent = trimmed.includes('%');
  const negativeByParens = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed
    .replace(/[,$%\s]/g, '')
    .replace(/[()]/g, '')
    .replace(/[^\d.-]/g, '');
  if (!cleaned) return null;

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  const signed = negativeByParens ? -Math.abs(parsed) : parsed;
  return isPercent ? signed : signed;
};

const detectDelimiter = (csvData: string): string => {
  const candidates = [',', ';', '\t', '|'];
  const lines = csvData
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);
  if (lines.length === 0) return ',';

  let bestDelimiter = ',';
  let bestScore = -1;

  for (const delimiter of candidates) {
    const score = lines.reduce((acc, line) => acc + (line.split(delimiter).length - 1), 0);
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
};

const parseCsvLine = (line: string, delimiter: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const parseCsvRows = (csvData: string): string[][] => {
  const delimiter = detectDelimiter(csvData);
  const lines = csvData.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => parseCsvLine(line, delimiter));
};

const coerceMetrics = (payload: unknown): ExtractedMetric[] => {
  const asArray = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as any).metrics)
      ? (payload as any).metrics
      : [];

  return asArray
    .map((item) => {
      const key = normalizeKey(String((item as any)?.key || ''));
      const value = parseNumberish((item as any)?.value);
      if (!key || value === null) return null;
      return { key, value };
    })
    .filter((item): item is ExtractedMetric => Boolean(item));
};

const extractLikelyJson = (rawText: string): string | null => {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstArrayStart = trimmed.indexOf('[');
  const firstArrayEnd = trimmed.lastIndexOf(']');
  if (firstArrayStart !== -1 && firstArrayEnd > firstArrayStart) {
    return trimmed.slice(firstArrayStart, firstArrayEnd + 1);
  }

  const firstObjStart = trimmed.indexOf('{');
  const firstObjEnd = trimmed.lastIndexOf('}');
  if (firstObjStart !== -1 && firstObjEnd > firstObjStart) {
    return trimmed.slice(firstObjStart, firstObjEnd + 1);
  }

  return null;
};

const extractMetricsFromCsvLocal = (csvData: string): ExtractedMetric[] => {
  const rows = parseCsvRows(csvData);
  if (rows.length === 0) return [];

  const usedKeys = new Set<string>();
  const metrics: ExtractedMetric[] = [];

  const firstRow = rows[0] || [];
  const firstRowNumericCount = firstRow.filter((cell) => parseNumberish(cell) !== null).length;
  const hasHeader = firstRowNumericCount === 0;
  const headers = hasHeader ? firstRow.map((cell, idx) => normalizeKey(cell || `col_${idx + 1}`)) : [];
  const startRow = hasHeader ? 1 : 0;

  for (let rowIndex = startRow; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row || row.length === 0) continue;

    const firstCell = row[0] || '';
    const rowLabel = parseNumberish(firstCell) === null && firstCell ? normalizeKey(firstCell) : '';
    const numericCells = row.reduce<number[]>((acc, cell, idx) => {
      if (parseNumberish(cell) !== null) acc.push(idx);
      return acc;
    }, []);

    if (numericCells.length === 0) continue;

    for (const colIndex of numericCells) {
      const rawValue = row[colIndex];
      const value = parseNumberish(rawValue);
      if (value === null) continue;

      const headerLabel = headers[colIndex] || '';
      let rawKey = '';

      if (rowLabel && headerLabel && headerLabel !== rowLabel) {
        rawKey = `${rowLabel}_${headerLabel}`;
      } else if (headerLabel) {
        rawKey = headerLabel;
      } else if (rowLabel) {
        rawKey = `${rowLabel}_value_${colIndex + 1}`;
      } else {
        rawKey = `row_${rowIndex + 1}_col_${colIndex + 1}`;
      }

      const key = buildUniqueKey(rawKey, usedKeys);
      metrics.push({ key, value });
    }
  }

  return metrics;
};

const mergeMetrics = (primary: ExtractedMetric[], secondary: ExtractedMetric[]): ExtractedMetric[] => {
  const byKey = new Map<string, ExtractedMetric>();
  [...secondary, ...primary].forEach((metric) => {
    if (!metric || !metric.key || !Number.isFinite(metric.value)) return;
    byKey.set(metric.key, metric);
  });
  return Array.from(byKey.values());
};

export const extractFinancialData = async (csvData: string): Promise<ExtractedMetric[]> => {
  const localMetrics = extractMetricsFromCsvLocal(csvData);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Extract ALL numeric financial fields from the following data.
Rules:
1. Return a JSON array where each item has "key" and "value".
2. Include as many valid numeric fields as possible, not just a few headline metrics.
3. Use snake_case keys.
4. Preserve detail by using descriptive keys (e.g., segment_revenue, q1_net_income, costs_marketing).
5. Keep values numeric only.

Data:
${csvData}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING, description: 'Standardized financial key in snake_case' },
              value: { type: Type.NUMBER, description: 'The numeric value of the metric' }
            },
            required: ['key', 'value']
          }
        }
      }
    });
    
    if (!response.text) {
      throw new Error("Empty response from Gemini");
    }

    const rawText = response.text.trim();
    const likelyJson = extractLikelyJson(rawText);
    if (!likelyJson) {
      throw new Error('No JSON payload found in Gemini response.');
    }

    const parsedPayload = JSON.parse(likelyJson);
    const extracted = coerceMetrics(parsedPayload);
    const merged = mergeMetrics(extracted, localMetrics);
    if (merged.length > 0) {
      return merged;
    }

    throw new Error('No usable metrics after merge.');
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    if (localMetrics.length > 0) {
      return localMetrics;
    }
    throw new Error("Failed to parse financial data from the file. Please ensure the file contains valid financial metrics.");
  }
};

export const generateTemplateFromFields = async (fields: string[]): Promise<string> => {
  const safeFields = fields.filter(Boolean);
  if (safeFields.length === 0) {
    throw new Error('Select at least one field.');
  }

  const prompt = `
Generate a detailed financial report template in markdown format.
Use placeholders exactly in this format: {{field_name}}.
Only use the following placeholders:
${safeFields.map((f) => `- {{${f}}}`).join('\n')}

Output requirements:
1. Executive summary section
2. Operational performance section
3. Risk and anomaly watchlist section
4. Recommended actions section
5. Keep placeholder names unchanged
6. Keep output concise and practical
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'Return only the template content with headings and bullet points. Do not wrap in code fences.',
      },
    });

    return response.text || 'No template generated.';
  } catch (e) {
    console.error('Failed to generate template from fields', e);
    throw new Error('Failed to auto-generate template.');
  }
};

export const generateAuditReport = async (
  currentData: FinancialRecord[],
  historicalData: FinancialRecord[],
  language: 'en' | 'uz' | 'ru' = 'en',
): Promise<string> => {
  const languageName = language === 'ru' ? 'Russian' : language === 'uz' ? 'Uzbek' : 'English';
  const prompt = `
Act as a fintech financial insights agent.
Analyze the following current and historical financial data.
1. Identify any mathematical inconsistencies or anomalies.
2. Provide insights on why specific metrics changed compared to previous versions.
3. Write the final report in ${languageName}.

Current Data:
${JSON.stringify(currentData.map(d => ({ key: d.key, value: d.value, version: d.version })), null, 2)}

Historical Data:
${JSON.stringify(historicalData.map(d => ({ key: d.key, value: d.value, version: d.version })), null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: `Return only the report content in ${languageName}. Do not add intro text. Mention that this is educational analysis, not financial advice. Do not give legal, tax, or investment advice. Format with clear markdown headings and bullet points.`
      }
    });

    return response.text || "No analysis generated.";
  } catch (e) {
    console.error("Failed to generate audit report", e);
    throw new Error("Failed to generate audit report.");
  }
};
