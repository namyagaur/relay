import { listDeliveries } from './deliveries';
import { listEndpoints } from './endpoints';
import { listEvents } from './events';
import { listProjects } from './projects';

export async function searchAll(term) {
  const query = term.trim().toLowerCase();
  if (query.length < 2) return { items: [] };

  const [projects, events, deliveries, endpoints] = await Promise.all([
    listProjects(),
    listEvents({ search: query, pageSize: 100 }),
    listDeliveries({ search: query, pageSize: 100 }),
    listEndpoints(),
  ]);
  const includes = (value) => String(value ?? '').toLowerCase().includes(query);
  const items = [
    ...projects.items
      .filter((project) => includes(project.name) || includes(project.id))
      .map((project) => ({
        type: 'Project',
        id: project.id,
        label: project.name,
        subtitle: project.id,
        to: `/projects/${project.id}`,
      })),
    ...events.items.map((event) => ({
      type: 'Event',
      id: event.id,
      label: event.id,
      subtitle: event.type,
      to: `/events/${event.id}`,
    })),
    ...deliveries.items.map((delivery) => ({
      type: 'Delivery',
      id: delivery.id,
      label: delivery.id,
      subtitle: delivery.endpoint_url,
      to: `/deliveries/${delivery.id}`,
    })),
    ...endpoints.items
      .filter((endpoint) => includes(endpoint.url) || includes(endpoint.description))
      .map((endpoint) => ({
        type: 'Endpoint',
        id: endpoint.id,
        label: endpoint.url,
        subtitle: endpoint.description,
        to: `/endpoints/${endpoint.id}`,
      })),
  ];
  return { items };
}
