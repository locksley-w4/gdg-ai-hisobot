const { VertexAI } = require('@google-cloud/vertexai');

let vertexAI = null;

function getVertexClient() {
  if (!vertexAI) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    if (!project) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is not set');
    }

    vertexAI = new VertexAI({ project, location });
  }
  return vertexAI;
}

async function generateReport(prompt, modelId) {
  const model = modelId || process.env.VERTEX_AI_MODEL || 'gemini-1.5-pro';

  const client = getVertexClient();
  const generativeModel = client.getGenerativeModel({ model });

  const request = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  };

  const response = await generativeModel.generateContent(request);
  const result = response.response;

  if (
    result.candidates &&
    result.candidates.length > 0 &&
    result.candidates[0].content &&
    result.candidates[0].content.parts &&
    result.candidates[0].content.parts.length > 0
  ) {
    return result.candidates[0].content.parts[0].text;
  }

  throw new Error('No content generated from Vertex AI');
}

module.exports = { generateReport };
