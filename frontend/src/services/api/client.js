export const API_KEY_STORAGE_KEY = 'relay.apiKey';
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'
).replace(/\/+$/, '');

let unauthorizedHandler = null;

/**
 * @typedef {Object} RequestOptions
 * @property {string} [method]
 * @property {Record<string, unknown>} [body]
 * @property {Record<string, string | number | boolean | null | undefined>} [query]
 * @property {string} [apiKey]
 * @property {boolean} [authenticated]
 * @property {number} [timeoutMs]
 */

export class RelayApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED' } = {}) {
    super(message);
    this.name = 'RelayApiError';
    this.status = status;
    this.code = code;
  }
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

function getStoredApiKey() {
  try {
    return window.sessionStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    throw new RelayApiError('Session storage is unavailable in this browser.');
  }
}

function errorMessage(status, payload, apiKey) {
  const responseMessage = payload?.error?.message;
  if (typeof responseMessage === 'string') {
    const redactedMessage = apiKey
      ? responseMessage.replaceAll(apiKey, '[redacted]')
      : responseMessage;
    return redactedMessage.replace(/\brelay_[A-Za-z0-9_-]{43}\b/g, '[redacted]').trim();
  }

  if (status === 401) return 'The API key is invalid, expired, or revoked.';
  if (status === 403) return 'This API key is not allowed to perform that action.';
  if (status === 404) return 'The requested Relay resource was not found.';
  if (status === 409) return 'The request conflicts with the current resource state.';
  if (status === 422) return 'The request contains invalid data.';
  if (status >= 500) return 'Relay could not complete the request. Try again later.';
  return `Relay request failed (${status}).`;
}

/**
 * @param {string} path
 * @param {RequestOptions} [options]
 */
export async function request(
  path,
  { method = 'GET', body, query, apiKey, authenticated = true, timeoutMs = 10000 } = {},
) {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const url = new URL(`${API_BASE_URL}${path}${params.size ? `?${params}` : ''}`, window.location.origin);
  const storedApiKey = authenticated && apiKey === undefined ? getStoredApiKey() : null;
  const credential = apiKey ?? storedApiKey;
  const headers = { accept: 'application/json' };

  if (credential) headers.authorization = `Bearer ${credential}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new RelayApiError('The Relay API request timed out.', { code: 'TIMEOUT' });
      }
      if (error instanceof RelayApiError) throw error;
      throw new RelayApiError('Could not connect to the Relay API.', { code: 'NETWORK_ERROR' });
    }

    if (response.status === 204) {
      if (!response.ok) throw new RelayApiError(errorMessage(response.status, null, credential), { status: response.status });
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    let payload = null;
    if (contentType.includes('application/json')) {
      try {
        payload = await response.json();
      } catch {
        throw new RelayApiError('Relay returned an invalid response.', {
          status: response.status,
          code: 'INVALID_RESPONSE',
        });
      }
    }

    if (!response.ok) {
      if (response.status === 401 && storedApiKey) unauthorizedHandler?.();
      throw new RelayApiError(errorMessage(response.status, payload, credential), {
        status: response.status,
        code: payload?.error?.code ?? 'REQUEST_FAILED',
      });
    }

    if (!contentType.includes('application/json')) {
      throw new RelayApiError('Relay returned an invalid response.', {
        status: response.status,
        code: 'INVALID_RESPONSE',
      });
    }
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}
