import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Webhook } from 'lucide-react';
import { formatDate, formatNumber, formatPercent } from '@/utils/format';
import { getProject } from '@/services/api/projects';
import PageHeader from '@/components/shared/PageHeader';
import Panel from '@/components/shared/Panel';
import StatTile from '@/components/shared/StatTile';
import StatusBadge from '@/components/shared/StatusBadge';
import EventsTable from '@/components/events/EventsTable';
import DeliveriesTable from '@/components/deliveries/DeliveriesTable';
import NotFoundState from '@/components/shared/NotFoundState';
import ErrorState from '@/components/shared/ErrorState';
import EmptyState from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProjectDetails() {
  const { projectId } = useParams();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  });

  if (isError) {
    return (
      <>
        <PageHeader title="Project" backTo="/projects" backLabel="Projects" />
        <ErrorState title="Unable to load project" message={error?.message} onRetry={refetch} />
      </>
    );
  }

  if (!isLoading && !data) {
    return (
      <>
        <PageHeader title="Project" backTo="/projects" backLabel="Projects" />
        <NotFoundState title="Project not found" backTo="/projects" backLabel="Back to projects" />
      </>
    );
  }

  const project = data?.project;

  return (
    <div>
      <PageHeader
        backTo="/projects"
        backLabel="Projects"
        title={isLoading ? 'Loading project…' : project.name}
        description={project?.description}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Events" value={isLoading ? '—' : formatNumber(project.event_count)} hint="Total received" />
        <StatTile
          label="Deliveries"
          value={isLoading ? '—' : formatNumber(project.delivery_count)}
          hint="Delivery attempts tracked"
        />
        <StatTile label="Endpoints" value={isLoading ? '—' : formatNumber(project.endpoint_count)} hint="Registered targets" />
        <StatTile
          label="Success rate"
          value={isLoading ? '—' : formatPercent(project.success_rate, 1)}
          hint="Across all deliveries"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Endpoints"
          description="Destinations receiving this project's events"
          action={
            <Link to="/endpoints" className="text-[11.5px] text-muted-foreground transition-colors hover:text-foreground">
              Manage
            </Link>
          }
          bodyClassName="p-0"
        >
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : data.endpoints.length ? (
            <ul className="divide-y divide-border">
              {data.endpoints.map((endpoint) => (
                <li key={endpoint.id}>
                  <Link
                    to={`/endpoints/${endpoint.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[11.5px] text-foreground">
                        {endpoint.url.replace('https://', '')}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {endpoint.description || 'No description'}
                      </span>
                    </span>
                    <StatusBadge status={endpoint.active ? 'active' : 'inactive'} />
                    <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                      {endpoint.success_rate == null ? '—' : formatPercent(endpoint.success_rate, 1)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Webhook} title="No endpoints in this project" />
          )}
        </Panel>

        <Panel title="Project details" description="Identity and lifecycle">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <dl className="divide-y divide-border">
              {[
                { label: 'Project ID', value: project.id, mono: true },
                { label: 'Created', value: formatDate(project.created_at) },
                { label: 'Events', value: formatNumber(project.event_count) },
                { label: 'Success rate', value: formatPercent(project.success_rate, 1) },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
                  <dt className="text-[11.5px] text-muted-foreground">{row.label}</dt>
                  <dd className={`min-w-0 truncate text-right text-[12px] text-foreground ${row.mono ? 'font-mono text-[11.5px]' : ''}`}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title="Recent events" description="Latest events in this project" bodyClassName="p-0">
        <EventsTable events={data?.recentEvents ?? []} loading={isLoading} emptyTitle="No events in this project" />
      </Panel>

      <Panel className="mt-4" title="Recent deliveries" description="Most recent delivery attempts" bodyClassName="p-0">
        <DeliveriesTable
          deliveries={data?.recentDeliveries ?? []}
          loading={isLoading}
          showProject={false}
          emptyTitle="No deliveries in this project"
        />
      </Panel>
    </div>
  );
}