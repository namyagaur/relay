import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radio, RefreshCw, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EVENT_STATUSES, PAGE_SIZE_EVENTS, RANGES } from '@/constants/domain';
import { formatNumber, relativeTime } from '@/utils/format';
import { listEvents } from '@/services/api/events';
import { listProjects } from '@/services/api/projects';
import PageHeader from '@/components/shared/PageHeader';
import Panel from '@/components/shared/Panel';
import SearchInput from '@/components/shared/SearchInput';
import FilterSelect from '@/components/shared/FilterSelect';
import Pagination from '@/components/shared/Pagination';
import ErrorState from '@/components/shared/ErrorState';
import EventsTable from '@/components/events/EventsTable';
import SendEventDialog from '@/components/events/SendEventDialog';
import { Button } from '@/components/ui/button';

export default function Events() {
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    type: 'all',
    projectId: 'all',
    range: '7d',
  });
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const update = (patch) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'options'],
    queryFn: listProjects,
    staleTime: 60000,
  });

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['events', filters, sort, page],
    queryFn: () =>
      listEvents({
        ...filters,
        sort: sort.key,
        dir: sort.dir,
        page,
        pageSize: PAGE_SIZE_EVENTS,
      }),
    placeholderData: (previous) => previous,
  });

  const events = data?.items ?? [];
  const eventTypes = data?.eventTypes ?? [];
  const projectOptions = [
    { value: 'all', label: 'All projects' },
    ...(projectsData?.items ?? []).map((project) => ({ value: project.id, label: project.name })),
  ];

  const handleSort = (key) => {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' },
    );
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Events"
        description="Inspect and manage events received by Relay."
        actions={<div className="flex items-center gap-2">
          <Button size="sm" className="h-8 gap-1.5 text-[12.5px]" onClick={() => setSendDialogOpen(true)}>
            <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
            Send event
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-[12.5px]"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} strokeWidth={1.75} />
            Refresh
          </Button>
        </div>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={filters.search}
          onChange={(value) => update({ search: value })}
          placeholder="Search event ID or type…"
          className="w-full sm:w-[248px]"
        />
        <FilterSelect
          value={filters.status}
          onChange={(value) => update({ status: value })}
          options={[
            { value: 'all', label: 'All statuses' },
            ...EVENT_STATUSES.map((status) => ({ value: status, label: status[0].toUpperCase() + status.slice(1) })),
          ]}
          ariaLabel="Filter by status"
          className="w-[132px]"
        />
        <FilterSelect
          value={filters.type}
          onChange={(value) => update({ type: value })}
          options={[{ value: 'all', label: 'All event types' }, ...eventTypes.map((type) => ({ value: type, label: type }))]}
          ariaLabel="Filter by event type"
          className="w-[152px]"
        />
        <FilterSelect
          value={filters.projectId}
          onChange={(value) => update({ projectId: value })}
          options={projectOptions}
          ariaLabel="Filter by project"
          className="w-[148px]"
        />
        <FilterSelect
          value={filters.range}
          onChange={(value) => update({ range: value })}
          options={RANGES}
          ariaLabel="Date range"
          className="w-[140px]"
        />
        <span className="ml-auto hidden text-[11.5px] text-muted-foreground sm:inline">
          {isLoading ? 'Loading…' : `${formatNumber(data?.total ?? 0)} events`}
          {data?.hasMore ? ' · latest 100' : ''}
        </span>
      </div>

      {isError ? (
        <ErrorState title="Unable to load events" message={error?.message} onRetry={refetch} />
      ) : (
        <Panel bodyClassName="p-0">
          <EventsTable
            events={events}
            loading={isLoading}
            sortKey={sort.key}
            sortDir={sort.dir}
            onSort={handleSort}
            emptyTitle="No events match these filters"
          />
          <Pagination
            page={data?.page ?? 1}
            pageCount={data?.pageCount ?? 1}
            total={data?.total ?? 0}
            pageSize={PAGE_SIZE_EVENTS}
            onPage={setPage}
          />
          {data?.hasMore && (
            <p className="px-4 pb-2 text-[10.5px] text-muted-foreground">
              Showing the most recent 100 API results. Narrow the status filter to search a different subset.
            </p>
          )}
          {events.length > 0 && (
            <p className="px-4 py-2 text-[10.5px] text-muted-foreground">
              Latest event {relativeTime(events[0]?.created_at)} · <span className="font-mono">{events[0]?.id}</span>
            </p>
          )}
        </Panel>
      )}

      {!isLoading && !isError && events.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Radio className="h-3.5 w-3.5" strokeWidth={1.75} />
          Events are immutable once received. Replayed events create new delivery attempts.
        </div>
      )}
      <SendEventDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen} />
    </div>
  );
}
