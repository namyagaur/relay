import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { formatDuration, formatShortDateTime } from '@/utils/format';
import { cn } from '@/lib/utils';

export default function DeliveriesTable({
  deliveries = [],
  loading = false,
  sortKey = undefined,
  sortDir = undefined,
  onSort = undefined,
  showProject = true,
  emptyTitle = 'No deliveries found',
  emptyDescription = 'Try adjusting the filters or widening the date range.',
}) {
  const navigate = useNavigate();

  const columns = [
    {
      key: 'id',
      header: 'Delivery ID',
      sortable: true,
      render: (delivery) => <span className="font-mono text-[11.5px] text-foreground">{delivery.id}</span>,
    },
    {
      key: 'event_id',
      header: 'Event',
      render: (delivery) => <span className="font-mono text-[11px] text-muted-foreground">{delivery.event_id}</span>,
    },
    {
      key: 'endpoint_url',
      header: 'Endpoint',
      render: (delivery) => (
        <span className="block max-w-[220px] truncate font-mono text-[11px] text-muted-foreground">
          {delivery.endpoint_url.replace('https://', '')}
        </span>
      ),
    },
    ...(showProject
      ? [
          {
            key: 'project_name',
            header: 'Project',
            render: (delivery) => <span className="text-muted-foreground">{delivery.project_name}</span>,
          },
        ]
      : []),
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (delivery) => <StatusBadge status={delivery.status} />,
    },
    {
      key: 'http_status',
      header: 'HTTP',
      sortable: true,
      render: (delivery) => (
        <span
          className={cn(
            'font-mono text-[11.5px] tabular-nums',
            delivery.http_status == null
              ? 'text-muted-foreground'
              : delivery.http_status >= 400
                ? 'text-danger'
                : 'text-success',
          )}
        >
          {delivery.http_status ?? '—'}
        </span>
      ),
    },
    {
      key: 'attempt_count',
      header: 'Attempts',
      sortable: true,
      className: 'text-right',
      headerClassName: 'text-right',
      render: (delivery) => (
        <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">{delivery.attempt_count}</span>
      ),
    },
    {
      key: 'duration_ms',
      header: 'Duration',
      sortable: true,
      className: 'text-right',
      headerClassName: 'text-right',
      render: (delivery) => (
        <span className="whitespace-nowrap font-mono text-[11.5px] tabular-nums text-muted-foreground">
          {formatDuration(delivery.duration_ms)}
        </span>
      ),
    },
    {
      key: 'last_attempt_at',
      header: 'Last attempt',
      sortable: true,
      sortKey: 'last_attempt_at',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (delivery) => (
        <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
          {delivery.last_attempt_at ? formatShortDateTime(delivery.last_attempt_at) : 'Pending'}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={deliveries}
      loading={loading}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={onSort}
      minWidth={980}
      onRowClick={(delivery) => navigate(`/deliveries/${delivery.id}`)}
      empty={<EmptyState icon={Search} title={emptyTitle} description={emptyDescription} />}
    />
  );
}