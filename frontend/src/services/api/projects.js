import { getDashboardStats } from './dashboard';
import { listDeliveries } from './deliveries';
import { listEndpoints } from './endpoints';
import { listEvents } from './events';
import { getCurrentProject } from './session';
import { request } from './client';

async function getProjectSummary(project) {
  const [stats, endpoints] = await Promise.all([getDashboardStats(), listEndpoints()]);
  return {
    ...project,
    event_count: stats.totalEvents,
    delivery_count: stats.totalDeliveryAttempts,
    endpoint_count: endpoints.total,
    success_rate: stats.successRate,
    created_at: project.createdAt,
  };
}

export async function listProjects() {
  const project = await getCurrentProject();
  return { items: [await getProjectSummary(project)], total: 1 };
}

export async function getProject(projectId) {
  const currentProject = await getCurrentProject();
  if (currentProject.id !== projectId) return null;

  const [project, endpointsResponse, events, deliveries] = await Promise.all([
    getProjectSummary(currentProject),
    listEndpoints(),
    listEvents({ pageSize: 8 }),
    listDeliveries({ pageSize: 8 }),
  ]);
  return {
    project,
    endpoints: endpointsResponse.items,
    recentEvents: events.items,
    recentDeliveries: deliveries.items,
  };
}

export async function createProject({ name }) {
  const response = await request('/projects', {
    method: 'POST',
    body: { name },
    authenticated: false,
  });
  return {
    ...response.project,
    project: response.project,
    apiKey: response.apiKey,
  };
}
