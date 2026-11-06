import { request } from './client';

export async function listApiKeys() {
  const response = await request('/api-keys');
  return {
    items: response.data.map((key) => ({
      ...key,
      created_at: key.createdAt,
      last_used_at: key.lastUsedAt,
      status: key.revokedAt ? 'revoked' : 'active',
      masked_key: 'Hidden after creation',
    })),
    total: response.data.length,
  };
}

export async function createApiKey(payload) {
  const response = await request('/api-keys', { method: 'POST', body: payload });
  return {
    ...response,
    full_key: response.apiKey,
    created_at: response.createdAt,
  };
}

export function revokeApiKey(keyId) {
  return request(`/api-keys/${encodeURIComponent(keyId)}`, { method: 'DELETE' });
}
