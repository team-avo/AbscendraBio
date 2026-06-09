const fetchFn = globalThis.fetch;

const PROD_BASE_URL = 'https://api.shipstation.com';
const MOCK_BASE_URL = 'https://docs.shipstation.com/_mock/openapi';

const SHIPSTATION_BASE_URL = 'https://api.shipstation.com';
const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY || '';
const SHIPSTATION_API_SECRET = process.env.SHIPSTATION_API_SECRET || '';
// Default to false - only allow mock fallback if explicitly enabled
const ALLOW_MOCK_FALLBACK = process.env.SHIPSTATION_ALLOW_MOCK_FALLBACK === 'true';

// Retry config. ShipStation rate-limits to ~200 req/min and returns 429 with a
// Retry-After header; transient 5xx are also worth retrying. Retrying globally
// (here, in the shared client) avoids every caller implementing its own backoff.
// https://docs.shipstation.com/rate-limits
const MAX_RETRIES = parseInt(process.env.SHIPSTATION_MAX_RETRIES || '3', 10);
const BASE_BACKOFF_MS = parseInt(process.env.SHIPSTATION_BACKOFF_MS || '500', 10);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

// Backoff: honor Retry-After (seconds) when present, else exponential + jitter.
function backoffMs(attempt, retryAfterSeconds) {
  if (retryAfterSeconds && !Number.isNaN(retryAfterSeconds)) {
    return retryAfterSeconds * 1000;
  }
  const exp = BASE_BACKOFF_MS * Math.pow(2, attempt);
  return exp + Math.floor(Math.random() * 250);
}

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
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) err.retryAfterSeconds = parseInt(retryAfter, 10);
    throw err;
  }

  return { data, status: response.status, duration };
}

async function ssRequest(method, path, body) {
  const initialBaseUrl = resolveBaseUrl(SHIPSTATION_BASE_URL);
  const useMockInitially = isMockUrl(initialBaseUrl);

  try {
    // Retry loop for transient failures (429 rate-limit, 5xx). Honors Retry-After.
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await performRequest({
          method,
          path,
          body,
          baseUrl: initialBaseUrl,
          useMock: useMockInitially,
        });
      } catch (err) {
        if (!isRetryable(err.status) || attempt >= MAX_RETRIES) throw err;
        const wait = backoffMs(attempt, err.retryAfterSeconds);
        console.warn(
          `⏳ ShipStation ${err.status} on ${method} ${path}; retry ${attempt + 1}/${MAX_RETRIES} in ${wait}ms`,
        );
        await sleep(wait);
        attempt += 1;
      }
    }
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
