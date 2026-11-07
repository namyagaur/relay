import { getCurrentProject } from './session';
import { request } from './client';

const PAGE_SIZE = 10;

function inRange(value, range) {
  if (!range || range === 'all') return true;
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

export async function listEvents(params = {}) {
  const project = await getCurrentProject();
  const response = await request('/events', {
    query: {
      limit: 100,
      status: params.status && params.status !== 'all' ? params.status : undefined,
    },
  });
  const allItems = response.data.map((event) => ({
    ...event,
    type: event.eventType,
    created_at: event.createdAt,
    project_id: project.id,
    project_name: project.name,
  }));
  const eventTypes = [...new Set(allItems.map((event) => event.type))].sort();
  let items = allItems;
  const term = params.search?.trim().toLowerCase();
  if (term) {
    items = items.filter((event) =>
      `${event.id} ${event.type}`.toLowerCase().includes(term),
    );
  }
  if (params.type && params.type !== 'all') {
    items = items.filter((event) => event.type === params.type);
  }
  if (params.projectId && params.projectId !== 'all') {
    items = items.filter((event) => event.project_id === params.projectId);
  }
  items = items.filter((event) => inRange(event.created_at, params.range));
  items.sort((left, right) => compare(left, right, params.sort ?? 'created_at', params.dir));

  const pageSize = params.pageSize ?? PAGE_SIZE;
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
    eventTypes,
  };
}

export async function getEvent(eventId) {
  const [event, deliveriesResponse, endpointResponse, project] = await Promise.all([
    request(`/events/${encodeURIComponent(eventId)}`),
    request('/deliveries', { query: { eventId, limit: 100 } }),
    request('/endpoints'),
    getCurrentProject(),
  ]);
  const endpoints = new Map(endpointResponse.data.map((endpoint) => [endpoint.id, endpoint]));
  return {
    ...event,
    type: event.eventType,
    created_at: event.createdAt,
    project_name: project.name,
    deliveries: deliveriesResponse.data.map((delivery) => ({
      id: delivery.id,
      endpoint_id: delivery.endpoint.id,
      endpoint_url: endpoints.get(delivery.endpoint.id)?.url ?? `Endpoint ${delivery.endpoint.id}`,
      status: delivery.status,
      http_status: delivery.responseStatusCode,
      attempt_count: delivery.attemptNumber,
      attempts: [{
        status: delivery.status,
        http_status: delivery.responseStatusCode,
        duration_ms: delivery.durationMs,
        timestamp: delivery.attemptedAt,
      }],
    })),
  };
}

export function createEvent({ eventType, payload, idempotencyKey }) {
  return request('/events', {
    method: 'POST',
    body: { eventType, payload },
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
}

export function replayEvent(eventId) {
  return request(`/events/${encodeURIComponent(eventId)}/replay`, { method: 'POST' });
}
