import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus, Webhook } from 'lucide-react';
import { formatDate, formatNumber, formatPercent, relativeTime } from '@/utils/format';
import { deleteEndpoint, listEndpoints, updateEndpoint } from '@/services/api/endpoints';
import PageHeader from '@/components/shared/PageHeader';
import Panel from '@/components/shared/Panel';
import SearchInput from '@/components/shared/SearchInput';
import FilterSelect from '@/components/shared/FilterSelect';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import AddEndpointDialog from '@/components/endpoints/AddEndpointDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

export default function Endpoints() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['endpoints', search, status],
    queryFn: () => listEndpoints({ search, status }),
  });

  const toggleMutation = useMutation({
    mutationFn: (/** @type {{id: string, active: boolean}} */ endpoint) =>
      updateEndpoint(endpoint.id, { isActive: !endpoint.active }),
    onSuccess: (endpoint) => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
      toast({
        title: endpoint.active ? 'Endpoint activated' : 'Endpoint paused',
        description: endpoint.url.replace('https://', ''),
      });
    },
    onError: (mutationError) =>
      toast({ variant: 'destructive', title: 'Update failed', description: mutationError.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (endpointId) => deleteEndpoint(endpointId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setPendingDelete(null);
      toast({ title: 'Endpoint deleted' });
    },
    onError: (mutationError) =>
      toast({ variant: 'destructive', title: 'Delete failed', description: mutationError.message }),
  });

  const endpoints = data?.items ?? [];

  const columns = [
    {
      key: 'url',
      header: 'Endpoint',
      render: (endpoint) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-[11.5px] text-foreground">{endpoint.url.replace('https://', '')}</p>
          <p className="mt-0.5 max-w-[300px] truncate text-[11px] text-muted-foreground">
            {endpoint.description || 'No description'}
          </p>
        </div>
      ),
    },
    {
      key: 'project_name',
      header: 'Project',
      render: (endpoint) => <span className="text-muted-foreground">{endpoint.project_name}</span>,
    },
    {
      key: 'active',
      header: 'Status',
      render: (endpoint) => <StatusBadge status={endpoint.active ? 'active' : 'inactive'} />,
    },
    {
      key: 'health',
      header: 'Delivery health',
      render: (endpoint) => (
        <div className="flex items-center gap-2">
          <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                endpoint.success_rate == null
                  ? 'bg-muted'
                  : endpoint.success_rate >= 95
                    ? 'bg-success'
                    : endpoint.success_rate >= 82
                      ? 'bg-warning'
                      : 'bg-danger',
              )}
                style={{ width: endpoint.success_rate == null ? '0%' : `${Math.max(3, endpoint.success_rate)}%` }}
            />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {endpoint.success_rate == null ? '—' : formatPercent(endpoint.success_rate, 1)}
          </span>
        </div>
      ),
    },
    {
      key: 'last_status',
      header: 'Last response',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (endpoint) => (
        <div className="text-right">
          <span
            className={cn(
              'font-mono text-[11.5px] tabular-nums',
              endpoint.last_status == null
                ? 'text-muted-foreground'
                : endpoint.last_status >= 400
                  ? 'text-danger'
                  : 'text-success',
            )}
          >
            {endpoint.last_status ?? '—'}
          </span>
          <p className="text-[10.5px] text-muted-foreground">
            {endpoint.last_delivery_at ? relativeTime(endpoint.last_delivery_at) : 'No deliveries'}
          </p>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (endpoint) => (
        <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
          {formatDate(endpoint.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (endpoint) => (
        <div onClick={(event) => event.stopPropagation()} className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Endpoint actions">
                <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[184px]">
              <DropdownMenuItem className="text-[12.5px]" onSelect={() => navigate(`/endpoints/${endpoint.id}`)}>
                View details
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-[12.5px]"
                onSelect={() => toggleMutation.mutate(endpoint)}
              >
                {endpoint.active ? 'Deactivate endpoint' : 'Activate endpoint'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[12.5px] text-destructive focus:text-destructive"
                onSelect={() => setPendingDelete(endpoint)}
              >
                Delete endpoint
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Endpoints"
        description="Configure and monitor your webhook destinations."
        actions={
          <Button size="sm" className="h-8 gap-1.5 text-[12.5px]" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add endpoint
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by URL or description…"
          className="w-full sm:w-[280px]"
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          ariaLabel="Filter by status"
          className="w-[132px]"
        />
        <span className="ml-auto hidden text-[11.5px] text-muted-foreground sm:inline">
          {isLoading ? 'Loading…' : `${formatNumber(data?.total ?? 0)} endpoints`}
        </span>
      </div>

      {isError ? (
        <ErrorState title="Unable to load endpoints" message={error?.message} onRetry={refetch} />
      ) : (
        <Panel bodyClassName="p-0">
          <DataTable
            columns={columns}
            rows={endpoints}
            loading={isLoading}
            minWidth={900}
            onRowClick={(endpoint) => navigate(`/endpoints/${endpoint.id}`)}
            empty={
              <EmptyState
                icon={Webhook}
                title={search || status !== 'all' ? 'No endpoints match these filters' : 'No endpoints yet'}
                description="Add a destination URL to start receiving event deliveries."
                action={
                  <Button size="sm" className="h-8 text-[12.5px]" onClick={() => setAddOpen(true)}>
                    Add endpoint
                  </Button>
                }
              />
            }
          />
        </Panel>
      )}

      <AddEndpointDialog open={addOpen} onOpenChange={setAddOpen} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title="Delete endpoint?"
        description={`${pendingDelete?.url ?? ''} will stop receiving events immediately. Delivery history is retained.`}
        confirmLabel="Delete endpoint"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </div>
  );
}