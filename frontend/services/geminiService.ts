import { GoogleGenAI, Type } from '@google/genai';
import { ExtractedMetric, FinancialRecord } from '../types.ts';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });

export const extractFinancialData = async (csvData: string): Promise<ExtractedMetric[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Extract the key financial metrics from the following raw data. Map them to standardized keys (e.g., 'total_revenue', 'net_income', 'operating_expenses', 'ebitda'). Ignore non-financial noise.\n\nData:\n${csvData}`,
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
    
    return JSON.parse(response.text.trim());
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Failed to parse financial data from the file. Please ensure the file contains valid financial metrics.");
  }
};

export const generateAuditReport = async (currentData: FinancialRecord[], historicalData: FinancialRecord[]): Promise<string> => {
  const prompt = `
Act as a fintech financial insights agent.
Analyze the following current and historical financial data.
1. Identify any mathematical inconsistencies or anomalies.
2. Provide insights on why specific metrics changed compared to previous versions.

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
        systemInstruction: "Return only the report content. Do not add intro text. Mention that this is educational analysis, not financial advice. Do not give legal, tax, or investment advice. Format with clear markdown headings and bullet points."
      }
    });

    return response.text || "No analysis generated.";
  } catch (e) {
    console.error("Failed to generate audit report", e);
    throw new Error("Failed to generate audit report.");
  }
};
