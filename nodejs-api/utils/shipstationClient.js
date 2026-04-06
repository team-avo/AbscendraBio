const fetchFn = globalThis.fetch;

const PROD_BASE_URL = 'https://api.shipstation.com';
const MOCK_BASE_URL = 'https://docs.shipstation.com/_mock/openapi';

const SHIPSTATION_BASE_URL = 'https://api.shipstation.com';
const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY || '';
const SHIPSTATION_API_SECRET = process.env.SHIPSTATION_API_SECRET || '';
// Default to false - only allow mock fallback if explicitly enabled
const ALLOW_MOCK_FALLBACK = process.env.SHIPSTATION_ALLOW_MOCK_FALLBACK === 'true';

function sanitizeBaseUrl(url) {
  return (url || '').replace(/\/$/, '');
}

function isMockUrl(url) {
  return url.includes('_mock');
}

function resolveBaseUrl(url) {
  const clean = sanitizeBaseUrl(url || PROD_BASE_URL);
  if (isMockUrl(clean)) {
    return clean;
  }
  return clean || PROD_BASE_URL;
}

function buildHeaders(useMock) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (!SHIPSTATION_API_KEY) {
    throw new Error('ShipStation API key is missing. Set SHIPSTATION_API_KEY environment variable.');
  }

  // ShipStation v2 API uses api-key header
  headers['api-key'] = SHIPSTATION_API_KEY;
  return headers;
}

async function performRequest({ method, path, body, baseUrl, useMock }) {
  const cleanBaseUrl = sanitizeBaseUrl(baseUrl);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${cleanBaseUrl}${cleanPath}`;

  if (!fetchFn) {
    const err = new Error('Global fetch is not available in this runtime');
    err.status = 500;
    throw err;
  }

  const requestInit = {
    method,
    headers: buildHeaders(useMock),
    body: body ? JSON.stringify(body) : undefined,
  };

  if (!useMock) {
    console.log('ShipStation Request:', { method, url, body });
  }

  const start = Date.now();
  const response = await fetchFn(url, requestInit);
  const duration = Date.now() - start;

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = text;
  }

  const logPayload = { status: response.status, duration, data };
  if (response.status >= 400) {
    console.error('ShipStation Error Response:', logPayload);
  } else if (!useMock) {
    console.log('ShipStation Response:', logPayload);
  }

  if (!response.ok) {
    const err = new Error((data && (data.message || data.error)) || `ShipStation error: ${response.status}`);
    err.status = response.status;
    err.data = data;
    err.duration = duration;
    throw err;
  }

  return { data, status: response.status, duration };
}

async function ssRequest(method, path, body) {
  const initialBaseUrl = resolveBaseUrl(SHIPSTATION_BASE_URL);
  const useMockInitially = isMockUrl(initialBaseUrl);

  try {
    return await performRequest({
      method,
      path,
      body,
      baseUrl: initialBaseUrl,
      useMock: useMockInitially,
    });
  } catch (error) {
    const shouldFallback =
      !useMockInitially &&
      ALLOW_MOCK_FALLBACK &&
      (error.status === 401 ||
        error.status === 403 ||
        !SHIPSTATION_API_KEY ||
        !SHIPSTATION_API_SECRET ||
        SHIPSTATION_API_KEY === 'YOUR_API_KEY_HERE' ||
        SHIPSTATION_API_SECRET === 'YOUR_API_SECRET_HERE');

    if (!shouldFallback) {
      throw error;
    }

    console.warn('⚠️  ShipStation production request failed, falling back to mock API:', {
      status: error.status,
      message: error.message,
    });

    return performRequest({
      method,
      path,
      body,
      baseUrl: MOCK_BASE_URL,
      useMock: true,
    });
  }
}

module.exports = {
  ssRequest,
};
