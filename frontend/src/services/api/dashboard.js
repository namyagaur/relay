import { format } from 'date-fns';
import { request } from './client';
import { getCurrentProject } from './session';

const RANGE_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function makeSeries(attempts, range) {
  const end = Date.now();
  const settings = range === '24h'
    ? { count: 12, step: 2 * 60 * 60 * 1000, label: 'HH:mm' }
    : range === '30d'
      ? { count: 15, step: 2 * 24 * 60 * 60 * 1000, label: 'MMM d' }
      : { count: 7, step: 24 * 60 * 60 * 1000, label: 'MMM d' };
  const series = Array.from({ length: settings.count }, (_, index) => {
    const start = end - (settings.count - index) * settings.step;
    return {
      start,
      end: start + settings.step,
      label: format(new Date(start), settings.label),
      delivered: 0,
      failed: 0,
    };
  });
  const cutoff = end - (RANGE_MS[range] ?? RANGE_MS['7d']);
  attempts.forEach((attempt) => {
    const attemptedAt = new Date(attempt.attemptedAt).getTime();
    if (attemptedAt < cutoff) return;
    const bucket = series.find((item) => attemptedAt >= item.start && attemptedAt < item.end);
    if (!bucket) return;
    if (attempt.status === 'delivered') bucket.delivered += 1;
    if (attempt.status === 'failed') bucket.failed += 1;
  });
  return series;
}

export async function getDashboard(range = '7d') {
  const window = RANGE_MS[range] ? range : '7d';
  const [project, statsResponse, activityResponse, healthResponse, endpointsResponse] = await Promise.all([
    getCurrentProject(),
    request('/dashboard/stats'),
    request('/dashboard/activity', { query: { limit: 50 } }),
    request('/dashboard/delivery-health', { query: { window } }),
    request('/endpoints'),
  ]);
  const { events, deliveryAttempts } = activityResponse.data;
  const endpointHealth = endpointsResponse.data.map((endpoint) => {
    const attempts = deliveryAttempts.filter((attempt) => attempt.endpoint.id === endpoint.id);
    const terminal = attempts.filter((attempt) => ['delivered', 'failed'].includes(attempt.status));
    const delivered = terminal.filter((attempt) => attempt.status === 'delivered').length;
    const lastAttempt = attempts[0];
    return {
      ...endpoint,
      active: endpoint.isActive,
      project_name: project.name,
      success_rate: terminal.length ? (delivered / terminal.length) * 100 : null,
      last_status: lastAttempt?.responseStatusCode ?? null,
      last_delivery_at: lastAttempt?.attemptedAt ?? null,
    };
  });

  return {
    kpis: {
      totalEvents: statsResponse.data.totalEvents,
      delivered: statsResponse.data.deliveredEvents,
      failed: statsResponse.data.failedEvents,
      pending: statsResponse.data.pendingProcessingEvents,
      successRate: statsResponse.data.successRate,
    },
    health: healthResponse.data,
    series: makeSeries(deliveryAttempts, window),
    recentEvents: events.map((event) => ({
      ...event,
      type: event.eventType,
      created_at: event.createdAt,
      project_name: project.name,
    })),
    endpointHealth,
  };
}

export async function getDashboardStats() {
  return (await request('/dashboard/stats')).data;
}
