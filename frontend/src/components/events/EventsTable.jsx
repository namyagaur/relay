import { useNavigate } from 'react-router-dom';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { formatShortDateTime } from '@/utils/format';
import { Search } from 'lucide-react';

export default function EventsTable({
  events = [],
  loading = false,
  sortKey = undefined,
  sortDir = undefined,
  onSort = undefined,
  emptyTitle = 'No events found',
}) {
  const navigate = useNavigate();

  const columns = [
    {
      key: 'id',
      header: 'Event ID',
      sortable: true,
      render: (event) => <span className="font-mono text-[11.5px] text-foreground">{event.id}</span>,
    },
    {
      key: 'type',
      header: 'Event type',
      sortable: true,
      render: (event) => <span className="text-foreground">{event.type}</span>,
    },
    {
      key: 'project_name',
      header: 'Project',
      render: (event) => <span className="text-muted-foreground">{event.project_name}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (event) => <StatusBadge status={event.status} />,
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      headerClassName: 'text-right',
      className: 'text-right',
      render: (event) => (
        <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
          {formatShortDateTime(event.created_at)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={events}
      loading={loading}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={onSort}
      minWidth={720}
      onRowClick={(event) => navigate(`/events/${event.id}`)}
      empty={
        <EmptyState
          icon={Search}
          title={emptyTitle}
          description="Try changing the filters or searching for a different event ID."
        />
      }
    />
  );
}