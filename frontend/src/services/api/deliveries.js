import { getCurrentProject } from './session';
import { request } from './client';

function inRange(value, range) {
  const duration = { '24h': 1, '7d': 7, '14d': 14, '30d': 30 }[range];
  if (!duration) return true;
  return new Date(value).getTime() >= Date.now() - duration * 24 * 60 * 60 * 1000;
}

function compare(left, right, key, direction) {
  const factor = direction === 'asc' ? 1 : -1;
  const a = left[key];
  const b = right[key];
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return String(a).localeCompare(String(b), undefined, { numeric: true }) * factor;
}

export async function listDeliveries(params = {}) {
  const [project, response, endpointsResponse] = await Promise.all([
    getCurrentProject(),
    request('/deliveries', {
      query: {
        limit: 100,
        status: params.status && params.status !== 'all' ? params.status : undefined,
        endpointId: params.endpointId && params.endpointId !== 'all' ? params.endpointId : undefined,
        eventId: params.eventId,
      },
    }),
    request('/endpoints'),
  ]);
  const endpoints = new Map(endpointsResponse.data.map((endpoint) => [endpoint.id, endpoint]));
  let items = response.data.map((attempt) => ({
    id: attempt.id,
    event_id: attempt.event.id,
    event_type: attempt.event.eventType,
    endpoint_id: attempt.endpoint.id,
    endpoint_url: attempt.endpoint.url ?? endpoints.get(attempt.endpoint.id)?.url ?? `Endpoint ${attempt.endpoint.id}`,
    status: attempt.status,
    http_status: attempt.responseStatusCode,
    attempt_count: attempt.attemptNumber,
    duration_ms: attempt.durationMs,
    last_attempt_at: attempt.attemptedAt,
    project_id: project.id,
    project_name: project.name,
  }));
  const term = params.search?.trim().toLowerCase();
  if (term) {
    items = items.filter((delivery) =>
      `${delivery.id} ${delivery.event_id} ${delivery.event_type} ${delivery.endpoint_url}`.toLowerCase().includes(term),
    );
  }
  if (params.httpStatus && params.httpStatus !== 'all') {
    items = items.filter((delivery) => String(delivery.http_status) === String(params.httpStatus));
  }
  if (params.projectId && params.projectId !== 'all') {
    items = items.filter((delivery) => delivery.project_id === params.projectId);
  }
  items = items.filter((delivery) => inRange(delivery.last_attempt_at, params.range));
  items.sort((left, right) => compare(left, right, params.sort ?? 'last_attempt_at', params.dir));

  const pageSize = params.pageSize ?? 12;
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, params.page ?? 1), pageCount);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageCount,
    pageSize,
    hasMore: response.pagination.hasMore,
  };
}

export async function getDelivery(deliveryId) {
  const delivery = await request(`/deliveries/${encodeURIComponent(deliveryId)}`);
  const history = delivery.attempts ?? [delivery];
  const latest = history[history.length - 1] ?? delivery;
  return {
    id: delivery.id,
    event_id: delivery.event.id,
    event_type: delivery.event.eventType,
    event_status: delivery.event.status,
    event_created_at: delivery.event.createdAt,
    event_payload: delivery.event.payload,
    endpoint_id: delivery.endpoint.id,
    endpoint_url: delivery.endpoint.url,
    status: latest.status,
    last_attempt_at: latest.attemptedAt,
    attempt_count: history.length,
    attempts: history.map((attempt) => ({
      id: attempt.id,
      number: attempt.attemptNumber,
      status: attempt.status,
      http_status: attempt.responseStatusCode,
      duration_ms: attempt.durationMs,
      timestamp: attempt.attemptedAt,
      error: attempt.errorMessage,
      request: {
        method: 'POST',
        url: delivery.endpoint.url,
        body: delivery.event.payload,
      },
      response: { body: attempt.responseBody },
    })),
  };
}
