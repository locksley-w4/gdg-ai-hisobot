
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import 'dotenv/config';
import express from 'express';
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const app = express();
app.use(express.json({limit: process?.env?.API_PAYLOAD_MAX_SIZE || "7mb"}));

const PORT = process?.env?.API_BACKEND_PORT || 5000;
const API_BACKEND_HOST = process?.env?.API_BACKEND_HOST || "127.0.0.1";

const GOOGLE_CLOUD_LOCATION = process?.env?.GOOGLE_CLOUD_LOCATION;
const GOOGLE_CLOUD_PROJECT = process?.env?.GOOGLE_CLOUD_PROJECT;
if (!GOOGLE_CLOUD_PROJECT || !GOOGLE_CLOUD_LOCATION) {
  console.error("Error: Environment variables GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION must be set.");
  process.exit(1);
}
const PROXY_HEADER = process?.env?.PROXY_HEADER;
if (!PROXY_HEADER) {
  console.error("Error: Environment variables PROXY_HEADER must be set.");
  process.exit(1);
}

const APP_BASIC_AUTH_USER = process?.env?.APP_BASIC_AUTH_USER || 'admin';
const APP_BASIC_AUTH_PASS = process?.env?.APP_BASIC_AUTH_PASS || '123';
if (!process?.env?.APP_BASIC_AUTH_USER || !process?.env?.APP_BASIC_AUTH_PASS) {
  console.warn('[Auth] APP_BASIC_AUTH_USER/APP_BASIC_AUTH_PASS missing. Falling back to defaults (admin/123).');
}

const AUTH_TOKEN_TTL_MS = Number(process?.env?.APP_AUTH_TOKEN_TTL_MS || 12 * 60 * 60 * 1000);
const APP_AUTH_ALLOW_ANY_LOGIN = process?.env?.APP_AUTH_ALLOW_ANY_LOGIN !== 'false';
const APP_AUTH_USER_STORE_FILE = process?.env?.APP_AUTH_USER_STORE_FILE || './users.json';
const authSessions = new Map();
const registeredUsers = new Map();

function resolveGoogleAuthOptions() {
  const inlineServiceAccountJson = process?.env?.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  if (inlineServiceAccountJson) {
    try {
      const credentials = JSON.parse(inlineServiceAccountJson);
      if (!credentials.client_email || !credentials.private_key) {
        throw new Error('Missing required fields client_email/private_key in GOOGLE_SERVICE_ACCOUNT_KEY_JSON.');
      }
      console.log('[Node Proxy] Using service account credentials from GOOGLE_SERVICE_ACCOUNT_KEY_JSON.');
      return { credentials };
    } catch (error) {
      console.error('[Node Proxy] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY_JSON:', error.message);
      process.exit(1);
    }
  }

  const serviceAccountPath = process?.env?.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath) {
    if (!fs.existsSync(serviceAccountPath)) {
      console.error(`[Node Proxy] GOOGLE_APPLICATION_CREDENTIALS file not found: ${serviceAccountPath}`);
      process.exit(1);
    }
    console.log(`[Node Proxy] Using service account key file from GOOGLE_APPLICATION_CREDENTIALS: ${serviceAccountPath}`);
    return { keyFilename: serviceAccountPath };
  }

  console.log('[Node Proxy] Using Application Default Credentials (gcloud auth application-default login).');
  return {};
}

function safeEquals(a, b) {
  const left = Buffer.from(a || '');
  const right = Buffer.from(b || '');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function issueSessionToken(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + AUTH_TOKEN_TTL_MS;
  authSessions.set(token, { username, expiresAt });
  return { token, expiresAt };
}

function getUserStorePath() {
  if (APP_AUTH_USER_STORE_FILE.startsWith('/') || /^[A-Za-z]:\\/.test(APP_AUTH_USER_STORE_FILE)) {
    return APP_AUTH_USER_STORE_FILE;
  }
  return fileURLToPath(new URL(APP_AUTH_USER_STORE_FILE, import.meta.url));
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${digest}`;
}

function verifyPassword(password, encodedHash) {
  const [salt, storedDigest] = String(encodedHash || '').split(':');
  if (!salt || !storedDigest) return false;
  const digest = crypto.scryptSync(password, salt, 64).toString('hex');
  return safeEquals(digest, storedDigest);
}

function loadRegisteredUsers() {
  const userStorePath = getUserStorePath();
  if (!fs.existsSync(userStorePath)) return;

  try {
    const raw = fs.readFileSync(userStorePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    parsed.forEach((user) => {
      if (!user || typeof user.username !== 'string' || typeof user.passwordHash !== 'string') return;
      registeredUsers.set(user.username, {
        passwordHash: user.passwordHash,
        createdAt: user.createdAt || null,
      });
    });
  } catch (error) {
    console.error('[Auth] Failed to load users from store:', error.message);
  }
}

function saveRegisteredUsers() {
  const userStorePath = getUserStorePath();
  const serializable = Array.from(registeredUsers.entries()).map(([username, details]) => ({
    username,
    passwordHash: details.passwordHash,
    createdAt: details.createdAt,
  }));
  fs.writeFileSync(userStorePath, JSON.stringify(serializable, null, 2), 'utf8');
}

function isValidUsername(username) {
  if (typeof username !== 'string') return false;
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 64) return false;
  return /^[A-Za-z0-9._-]+$/.test(trimmed);
}

function isValidPassword(password) {
  if (typeof password !== 'string') return false;
  return password.length >= 6;
}

function getAuthTokenFromRequest(req) {
  const token = req.headers['x-app-auth'];
  return typeof token === 'string' ? token : null;
}

function isValidSessionToken(token) {
  if (!token) return false;
  const session = authSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    authSessions.delete(token);
    return false;
  }
  return true;
}

function requireAppAuth(req, res, next) {
  const token = getAuthTokenFromRequest(req);
  if (!isValidSessionToken(token)) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid session token.' });
  }
  next();
}

app.set('trust proxy', 1 /* number of proxies between user and server */);

loadRegisteredUsers();

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Bad Request', message: 'username and password are required.' });
  }

  const storedUser = registeredUsers.get(username);
  if (storedUser) {
    if (!verifyPassword(password, storedUser.passwordHash)) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials.' });
    }
    const { token, expiresAt } = issueSessionToken(username);
    return res.status(200).json({ token, username, expiresAt });
  }

  const isBasicAuthUser = safeEquals(username, APP_BASIC_AUTH_USER) && safeEquals(password, APP_BASIC_AUTH_PASS);
  if (isBasicAuthUser || APP_AUTH_ALLOW_ANY_LOGIN) {
    const { token, expiresAt } = issueSessionToken(username);
    return res.status(200).json({ token, username, expiresAt });
  }

  return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials.' });
});

app.post('/auth/signup', (req, res) => {
  const { username, password } = req.body || {};
  if (!isValidUsername(username) || !isValidPassword(password)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Username must be 3-64 chars (letters/numbers/._-) and password must be at least 6 chars.',
    });
  }

  if (safeEquals(username, APP_BASIC_AUTH_USER) || registeredUsers.has(username)) {
    return res.status(409).json({ error: 'Conflict', message: 'Username already exists.' });
  }

  registeredUsers.set(username, {
    passwordHash: createPasswordHash(password),
    createdAt: new Date().toISOString(),
  });

  try {
    saveRegisteredUsers();
  } catch (error) {
    registeredUsers.delete(username);
    return res.status(500).json({ error: 'Server Error', message: `Failed to save user: ${error.message}` });
  }

  const { token, expiresAt } = issueSessionToken(username);
  return res.status(201).json({ token, username, expiresAt });
});

app.get('/auth/session', requireAppAuth, (_req, res) => {
  return res.status(200).json({ ok: true });
});

// IMPORTANT: Vertex AI Studio Rate Limiting
// This rate limiting configuration protects your backend APIs from abuse.
// Removing it exposes your service to DoS attacks and unexpected costs.
const proxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Set ratelimit window at 15min (in ms)
    max: 100, // Limit each IP to 100 requests per window 
    standardHeaders: true, // Return rate limit info in the "RateLimit-*" headers
    legacyHeaders: false, // no "X-RateLimit-*" headers
    message: {
      error: 'Too many requests',
      message: 'You have exceed the request limit, please try again later.'
    },
});
// Apply the rate limiter to the /api-proxy route before the main proxy logic
app.use('/api-proxy', proxyLimiter);
app.use('/api-proxy', requireAppAuth);

const API_CLIENT_MAP = [
 {
    name: "VertexGenAi:generateContent",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:generateContent",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:generateContent`;
    },
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "VertexGenAi:predict",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:predict",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:predict`;
    },
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "VertexGenAi:streamGenerateContent",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:streamGenerateContent",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:streamGenerateContent`;
    },
    isStreaming: true,
    transformFn: (response) => {
        let normalizedResponse = response.trim();
        while (normalizedResponse.startsWith(',') || normalizedResponse.startsWith('[')) {
          normalizedResponse = normalizedResponse.substring(1).trim();
        }
        while (normalizedResponse.endsWith(',') || normalizedResponse.endsWith(']')) {
          normalizedResponse = normalizedResponse.substring(0, normalizedResponse.length - 1).trim();
        }

        if (!normalizedResponse.length) {
          return {result: null, inProgress: false};
        }

        if (!normalizedResponse.endsWith('}')) {
          return {result: normalizedResponse, inProgress: true};
        }

        try {
          const parsedResponse = JSON.parse(`${normalizedResponse}`);
          const transformedResponse = `data: ${JSON.stringify(parsedResponse)}\n\n`;
          return {result: transformedResponse, inProgress: false};
        } catch (error) {
          throw new Error(`Failed to parse response: ${error}.`);
        }
    },
  },
 {
    name: "ReasoningEngine:query",
    patternForProxy: "https://{{endpoint_location}}-aiplatform.googleapis.com/{{version}}/projects/{{project_id}}/locations/{{location_id}}/reasoningEngines/{{engine_id}}:query",
    getApiEndpoint: (context, params) => {
      return `https://${params['endpoint_location']}-aiplatform.clients6.google.com/v1beta1/projects/${params['project_id']}/locations/${params['location_id']}/reasoningEngines/${params['engine_id']}:query`;
    },
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "ReasoningEngine:streamQuery",
    patternForProxy: "https://{{endpoint_location}}-aiplatform.googleapis.com/{{version}}/projects/{{project_id}}/locations/{{location_id}}/reasoningEngines/{{engine_id}}:streamQuery",
    getApiEndpoint: (context, params) => {
      return `https://${params['endpoint_location']}-aiplatform.clients6.google.com/v1beta1/projects/${params['project_id']}/locations/${params['location_id']}/reasoningEngines/${params['engine_id']}:streamQuery`;
    },
    isStreaming: true,
    transformFn: null,
  },
].map((client) => ({ ...client, patternInfo: parsePattern(client.patternForProxy) }));

// Uses service-account key when configured, otherwise falls back to ADC.
const auth = new GoogleAuth({
  ...resolveGoogleAuthOptions(),
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePattern(pattern) {
  const paramRegex = /\{\{(.*?)\}\}/g;
  const params = [];
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = paramRegex.exec(pattern)) !== null) {
    params.push(match[1]);
    const literalPart = pattern.substring(lastIndex, match.index);
    parts.push(escapeRegex(literalPart));
    parts.push(`(?<${match[1]}>[^/]+)`);
    lastIndex = paramRegex.lastIndex;
  }
  parts.push(escapeRegex(pattern.substring(lastIndex)));
  const regexString = parts.join('');

  return {regex: new RegExp(`^${regexString}$`), params};
}

function extractParams(patternInfo, url) {
  const match = url.match(patternInfo.regex);
  if (!match) return null;
  const params = {};
  patternInfo.params.forEach((paramName, index) => {
    params[paramName] = match[index + 1];
  });
  return params;
}

async function getAccessToken(res) {
  try {
    const authClient = await auth.getClient();
    const tokenResponse = await authClient.getAccessToken();
    return typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  } catch (error) {
    console.error('[Node Proxy] Authentication error:', error);
    if (!res) return null;
    if (error.code === 'ERR_GCLOUD_NOT_LOGGED_IN' || (error.message && error.message.includes('Could not load the default credentials'))) {
      res.status(401).json({
        error: 'Authentication Required',
        message: 'Credentials not found or invalid. Set GOOGLE_APPLICATION_CREDENTIALS to your service account key file, or run "gcloud auth application-default login".',
      });
    } else {
      res.status(500).json({ error: `Authentication failed: ${error.message}` });
    }
    return null;
  }
}

function getRequestHeaders(accessToken) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'X-Goog-User-Project': GOOGLE_CLOUD_PROJECT,
    'Content-Type': 'application/json',
  };
}

// --- Proxy Endpoint ---
app.post('/api-proxy', async (req, res) => {

  // Check for the custom header added by the shim
  if (req.headers['x-app-proxy'] !== PROXY_HEADER) {
    return res.status(403).send('Forbidden: Request must originate from the Vertex App shim.');
  }

  const { originalUrl, method, headers, body } = req.body;
  if (!originalUrl) {
    return res.status(400).send('Bad Request: originalUrl is required.');
  }

  // 1. Find the matching API client
  const apiClient = API_CLIENT_MAP.find(p => {
    // We store extractedParams on req for use later if needed, though getVertexUrl takes it as arg.
    req.extractedParams = extractParams(p.patternInfo, originalUrl);
    return req.extractedParams !== null;
  });

  if (!apiClient) {
    console.error(`[Node Proxy] No API client handler found for URL: ${originalUrl}`);
    return res.status(404).json({ error: `No proxy handler found for URL: ${originalUrl}` });
  }

  const extractedParams = req.extractedParams;
  console.log(`[Node Proxy] Matched API client: ${apiClient.name}`);
  try {
    // 2. Get authenticated access token
    const accessToken = await getAccessToken(res);
    if (!accessToken) return;

    // 3. Construct the full API URL using env-set GOOGLE_CLOUD_PROJECT/LOCATION and extracted params
    const context = {projectId: GOOGLE_CLOUD_PROJECT, region: GOOGLE_CLOUD_LOCATION};
    const apiUrl = apiClient.getApiEndpoint(context, extractedParams);
    console.log(`[Node Proxy] Forwarding to Vertex API: ${apiUrl}`);

    // 4. Prepare headers for the API call
    const apiHeaders = getRequestHeaders(accessToken);

    const apiFetchOptions = {
      method: method || 'POST',
      headers: {...headers, ...apiHeaders},
      body: body ? body : undefined,
    };

    // 5. Make the call to the API
    const apiResponse = await fetch(apiUrl, apiFetchOptions);

    // 6. Respond to the client based on stream type
    if (apiClient.isStreaming) {
      console.log(`[Node Proxy] Sending STREAMING response for ${apiClient.name}`);
      // Set headers for a streaming JSON response
      res.writeHead(apiResponse.status, {
        'Content-Type': 'text/event-stream',
        'Transfer-Encoding': 'chunked',
        'Connection': 'keep-alive',
      });
      // Immediately send headers
      res.flushHeaders();

      if (!apiResponse.body) {
        console.error('[Node Proxy] Streaming response has no body.');
        return res.end(JSON.stringify({ error: 'Streaming response body is null' }));
      }

      const decoder = new TextDecoder();
      let deltaChunk = '';
      apiResponse.body.on('data', (encodedChunk) => {
        if (res.writableEnded) return; // Prevent writing after res.end()

        try {
          if (!apiClient.transformFn) {
            res.write(encodedChunk);
          } else {
            const decodedChunk = decoder.decode(encodedChunk, { stream: true });
            deltaChunk = deltaChunk + decodedChunk;

            const {result, inProgress} = apiClient.transformFn(deltaChunk);
            if (result && !inProgress) {
              deltaChunk = '';
              res.write(new TextEncoder().encode(result));
            }
          }
        } catch (error) {
          console.error(`[Node Proxy] Error processing streaming response for ${apiClient.name}`);
          console.error(error);
        }
      });

      apiResponse.body.on('end', () => {
        deltaChunk = '';
        console.log(`[Node Proxy] Vertex stream finished and all data processed for ${apiClient.name}`);
        res.end();
      });

      apiResponse.body.on('error', (streamError) => {
        console.error('[Node Proxy] Error from Vertex stream:', streamError);
        if (!res.writableEnded) {
          res.end(JSON.stringify({ proxyError: 'Stream error from Vertex AI', details: streamError.message }));
        }
      });

      res.on('error', (resError) => {
        console.error('[Node Proxy] Error writing to client response:', resError);
        // The source stream might need to be destroyed if an error occurs here.
        if (apiResponse.body && typeof apiResponse.body.destroy === 'function') {
             apiResponse.body.destroy(resError);
        }
      });
    } else {
      // Non-streaming response handling
      console.log(`[Node Proxy] Sending JSON response for ${apiClient.name}`);
      const data = await apiResponse.json();
      res.status(apiResponse.status).json(data);
    }
  } catch (error) {
    console.error(`[Node Proxy] Error proxying request for ${apiClient.name}`);
    console.error(error)
    res.status(500).json({ error: error });
  }
});

const server = app.listen(PORT, API_BACKEND_HOST, () => {
  console.log(`Vertex AI Backend listening at http://localhost:${PORT}`);
});


const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === '/ws-proxy') {
    const wsAuthToken = url.searchParams.get('authToken');
    if (!isValidSessionToken(wsAuthToken)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    
    let targetUrl = url.searchParams.get('target');
    if (!targetUrl) {
      console.log('[Node Proxy] Missing target URL');
      socket.destroy();
      return;
    }

    if (targetUrl === 'wss://aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent') {
      const location = GOOGLE_CLOUD_LOCATION === 'global' ? 'us-central1' : GOOGLE_CLOUD_LOCATION;
      targetUrl = `wss://${location}-aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
    } else {
      console.log('[Node Proxy] Invalid target URL');
      socket.destroy();
      return;
    }

    let accessToken;

    try {
      accessToken = await getAccessToken();
      if (!accessToken) throw new Error('No token');
    } catch (err) {
      console.log('[Node Proxy] Authentication failed');
      socket.destroy();
      return;
    }

    console.log(`[Node Proxy] Initiating upstream connection to: ${targetUrl}`);

    let upstreamWs;

    try {
      upstreamWs = new WebSocket(targetUrl, {
        headers: getRequestHeaders(accessToken)
      });
    } catch (e) {
      console.error('[Node Proxy] Invalid Upstream URL');
      socket.destroy();
      return;
    }

    const initialErrorHandler = (error) => {
      console.error('[Node Proxy] Upstream connection failed:', error);
      upstreamWs.removeEventListener('open', onUpstreamOpen);

      if (socket.writable) {
        socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        socket.destroy();
      }
    };

    upstreamWs.once('error', initialErrorHandler);

    // 5. Handle Successful Upstream Connection
    const onUpstreamOpen = () => {
      // Remove the "bootstrapping" error handler
      upstreamWs.removeListener('error', initialErrorHandler);

      // Perform the HTTP -> WebSocket upgrade for the Client
      wss.handleUpgrade(request, socket, head, (ws) => {

        upstreamWs.on('message', (data, isBinary) => {
          const logMsg = isBinary ? '<Binary Data>' : data.toString();
          console.log(`[Upstream -> Client] [${new Date().toISOString()}]: ${logMsg}`);

          if (ws.readyState === WebSocket.OPEN) {
            if (data === undefined || data === null) {
              console.warn('[Node Proxy] Attempted to send undefined/null data to client');
              return;
            }
            ws.send(data, { binary: isBinary });
          }
        });

        ws.on('message', (data, isBinary) => {
          const logMsg = isBinary ? '<Binary Data>' : data.toString();

          let dataJson = {};
          try {
            dataJson = JSON.parse(data.toString());
          } catch (error) {
            console.error('[Node Proxy] Failed to parse message from client:', error);
            ws.close(1011, 'Failed to parse message');
          }

          if (dataJson['setup']) {
            dataJson['setup']['model'] = `projects/${GOOGLE_CLOUD_PROJECT}/locations/${GOOGLE_CLOUD_LOCATION}/${dataJson['setup']['model']}`;
          }

          if (upstreamWs.readyState === WebSocket.OPEN) {
            upstreamWs.send(JSON.stringify(dataJson), { binary: false });
          }
        });

        upstreamWs.on('error', (error) => {
          console.error('[Node Proxy] Upstream error:', error);
          ws.close(1011, error.message);
        });

        upstreamWs.on('close', (code, reason) => {
          console.log(`[Node Proxy] Upstream closed: ${code} ${reason}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(code, reason);
          }
        });

        ws.on('error', (error) => {
          console.error('[Node Proxy] Client error:', error);
          upstreamWs.close(1011, error.message);
        });

        ws.on('close', (code, reason) => {
          console.log(`[Node Proxy] Client closed: ${code} ${reason}`);
          if (upstreamWs.readyState === WebSocket.OPEN) {
            upstreamWs.close(1000, reason);
          }
        });

        wss.emit('connection', ws, request);
      });
    };

    upstreamWs.once('open', onUpstreamOpen);

  } else {
    // Path did not match
    socket.destroy();
  }
});


