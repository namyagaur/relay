import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DELIVERY_STATUSES, HTTP_CODES, PAGE_SIZE_DELIVERIES, RANGES } from '@/constants/domain';
import { formatNumber } from '@/utils/format';
import { listDeliveries } from '@/services/api/deliveries';
import { listEndpoints } from '@/services/api/endpoints';
import { listProjects } from '@/services/api/projects';
import PageHeader from '@/components/shared/PageHeader';
import Panel from '@/components/shared/Panel';
import SearchInput from '@/components/shared/SearchInput';
import FilterSelect from '@/components/shared/FilterSelect';
import Pagination from '@/components/shared/Pagination';
import ErrorState from '@/components/shared/ErrorState';
import DeliveriesTable from '@/components/deliveries/DeliveriesTable';
import { Button } from '@/components/ui/button';

export default function Deliveries() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: searchParams.get('search') ?? '',
    status: 'all',
    endpointId: 'all',
    projectId: 'all',
    httpStatus: 'all',
    range: '7d',
  });
  const [sort, setSort] = useState({ key: 'last_attempt_at', dir: 'desc' });
  const [page, setPage] = useState(1);

  const update = (patch) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const { data: endpointsData } = useQuery({
    queryKey: ['endpoints', 'options'],
    queryFn: () => listEndpoints({ sort: 'url', dir: 'asc' }),
    staleTime: 60000,
  });
  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'options'],
    queryFn: listProjects,
    staleTime: 60000,
  });

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['deliveries', filters, sort, page],
    queryFn: () =>
      listDeliveries({ ...filters, sort: sort.key, dir: sort.dir, page, pageSize: PAGE_SIZE_DELIVERIES }),
    placeholderData: (previous) => previous,
  });

  const deliveries = data?.items ?? [];

  const endpointOptions = [
    { value: 'all', label: 'All endpoints' },
    ...(endpointsData?.items ?? []).map((endpoint) => ({
      value: endpoint.id,
      label: endpoint.url.replace('https://', ''),
    })),
  ];
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
        title="Deliveries"
        description="Monitor webhook delivery attempts and troubleshoot failures."
        actions={
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
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={filters.search}
          onChange={(value) => update({ search: value })}
          placeholder="Search delivery, event or endpoint…"
          className="w-full sm:w-[268px]"
        />
        <FilterSelect
          value={filters.status}
          onChange={(value) => update({ status: value })}
          options={[
            { value: 'all', label: 'All statuses' },
            ...DELIVERY_STATUSES.map((status) => ({ value: status, label: status[0].toUpperCase() + status.slice(1) })),
          ]}
          ariaLabel="Filter by delivery status"
          className="w-[136px]"
        />
        <FilterSelect
          value={filters.endpointId}
          onChange={(value) => update({ endpointId: value })}
          options={endpointOptions}
          ariaLabel="Filter by endpoint"
          className="w-[168px]"
        />
        <FilterSelect
          value={filters.httpStatus}
          onChange={(value) => update({ httpStatus: value })}
          options={[
            { value: 'all', label: 'Any response' },
            ...HTTP_CODES.map((code) => ({ value: String(code), label: `HTTP ${code}` })),
          ]}
          ariaLabel="Filter by HTTP status"
          className="w-[132px]"
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
          {isLoading ? 'Loading…' : `${formatNumber(data?.total ?? 0)} deliveries`}
          {data?.hasMore ? ' · latest 100' : ''}
        </span>
      </div>

      {isError ? (
        <ErrorState title="Unable to load deliveries" message={error?.message} onRetry={refetch} />
      ) : (
        <Panel bodyClassName="p-0">
          <DeliveriesTable
            deliveries={deliveries}
            loading={isLoading}
            sortKey={sort.key}
            sortDir={sort.dir}
            onSort={handleSort}
          />
          <Pagination
            page={data?.page ?? 1}
            pageCount={data?.pageCount ?? 1}
            total={data?.total ?? 0}
            pageSize={PAGE_SIZE_DELIVERIES}
            onPage={setPage}
          />
          {data?.hasMore && (
            <p className="px-4 pb-2 text-[10.5px] text-muted-foreground">
              Showing the most recent 100 API results. Narrow the status or endpoint filter to search a different subset.
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}