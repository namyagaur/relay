import { getCurrentProject } from './session';
import { request } from './client';

function decorateEndpoint(endpoint, attempts, projectName) {
  const endpointAttempts = attempts.filter((attempt) => attempt.endpoint.id === endpoint.id);
  const terminal = endpointAttempts.filter((attempt) => ['delivered', 'failed'].includes(attempt.status));
  const delivered = terminal.filter((attempt) => attempt.status === 'delivered').length;
  const latest = endpointAttempts[0];
  return {
    ...endpoint,
    active: endpoint.isActive,
    created_at: endpoint.createdAt,
    project_name: projectName,
    success_rate: terminal.length ? (delivered / terminal.length) * 100 : null,
    last_status: latest?.responseStatusCode ?? null,
    last_delivery_at: latest?.attemptedAt ?? null,
  };
}

export async function listEndpoints(params = {}) {
  const [response, attemptsResponse, project] = await Promise.all([
    request('/endpoints'),
    request('/deliveries', { query: { limit: 100 } }),
    getCurrentProject(),
  ]);
  let items = response.data.map((endpoint) =>
    decorateEndpoint(endpoint, attemptsResponse.data, project.name),
  );
  const term = params.search?.trim().toLowerCase();
  if (term) {
    items = items.filter((endpoint) =>
      `${endpoint.url} ${endpoint.description ?? ''}`.toLowerCase().includes(term),
    );
  }
  if (params.status === 'active') items = items.filter((endpoint) => endpoint.isActive);
  if (params.status === 'inactive') items = items.filter((endpoint) => !endpoint.isActive);
  return { items, total: items.length };
}

export async function getEndpoint(endpointId) {
  const [endpoint, deliveriesResponse, project] = await Promise.all([
    request(`/endpoints/${encodeURIComponent(endpointId)}`),
    request('/deliveries', {
      query: { endpointId, limit: 100 },
    }),
    getCurrentProject(),
  ]);
  const decorated = decorateEndpoint(endpoint, deliveriesResponse.data, project.name);
  const terminal = deliveriesResponse.data.filter((attempt) =>
    ['delivered', 'failed'].includes(attempt.status),
  );
  const delivered = terminal.filter((attempt) => attempt.status === 'delivered').length;
  const durations = terminal.map((attempt) => attempt.durationMs).filter(Number.isFinite);
  return {
    ...decorated,
    stats: {
      deliveries: deliveriesResponse.data.length,
      delivered,
      failed: terminal.length - delivered,
      success_rate: terminal.length ? (delivered / terminal.length) * 100 : 0,
      average_duration: durations.length
        ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
        : null,
    },
    recentDeliveries: deliveriesResponse.data.map((attempt) => ({
      id: attempt.id,
      event_id: attempt.event.id,
      event_type: attempt.event.eventType,
      endpoint_id: attempt.endpoint.id,
      endpoint_url: attempt.endpoint.url,
      status: attempt.status,
      http_status: attempt.responseStatusCode,
      attempt_count: attempt.attemptNumber,
      duration_ms: attempt.durationMs,
      last_attempt_at: attempt.attemptedAt,
      project_name: project.name,
    })),
  };
}

export function createEndpoint(payload) {
  return request('/endpoints', { method: 'POST', body: payload });
}

export async function updateEndpoint(endpointId, payload) {
  const endpoint = await request(`/endpoints/${encodeURIComponent(endpointId)}`, {
    method: 'PATCH',
    body: payload,
  });
  return { ...endpoint, active: endpoint.isActive, created_at: endpoint.createdAt };
}

export function deleteEndpoint(endpointId) {
  return request(`/endpoints/${encodeURIComponent(endpointId)}`, { method: 'DELETE' });
}
