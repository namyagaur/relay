import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Power, Trash2 } from 'lucide-react';
import { formatDate, formatDuration, formatNumber, formatPercent } from '@/utils/format';
import { deleteEndpoint, getEndpoint, updateEndpoint } from '@/services/api/endpoints';
import PageHeader from '@/components/shared/PageHeader';
import Panel from '@/components/shared/Panel';
import StatTile from '@/components/shared/StatTile';
import DetailList from '@/components/shared/DetailList';
import StatusBadge from '@/components/shared/StatusBadge';
import NotFoundState from '@/components/shared/NotFoundState';
import ErrorState from '@/components/shared/ErrorState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DeliveriesTable from '@/components/deliveries/DeliveriesTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';

function EditEndpointDialog({ open, onOpenChange, endpoint }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [url, setUrl] = useState(endpoint?.url ?? '');
  const [description, setDescription] = useState(endpoint?.description ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !endpoint) return;
    setUrl(endpoint.url);
    setDescription(endpoint.description ?? '');
    setError('');
  }, [open, endpoint]);

  const mutation = useMutation({
    mutationFn: (/** @type {{url?: string, description?: string | null, isActive?: boolean}} */ payload) =>
      updateEndpoint(endpoint.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endpoint', endpoint.id] });
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
      toast({ title: 'Endpoint updated' });
      onOpenChange(false);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const submit = (event) => {
    event.preventDefault();
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== 'https:') throw new Error('invalid');
    } catch {
      setError('Enter a valid HTTPS URL.');
      return;
    }
    setError('');
    mutation.mutate({ url: url.trim(), description: description.trim() || null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] border-border bg-surface">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-semibold tracking-[-0.02em]">Edit endpoint</DialogTitle>
          <DialogDescription className="text-[12.5px] text-muted-foreground">
            Changing the URL takes effect on the next delivery.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <Label htmlFor="edit-endpoint-url" className="text-[12px]">
              Endpoint URL
            </Label>
            <Input
              id="edit-endpoint-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="mt-1.5 h-9 font-mono text-[12.5px]"
            />
          </div>
          <div>
            <Label htmlFor="edit-endpoint-description" className="text-[12px]">
              Description
            </Label>
            <Textarea
              id="edit-endpoint-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="mt-1.5 resize-none text-[13px]"
            />
          </div>
          {error && <p className="text-[11.5px] text-destructive">{error}</p>}
          <DialogFooter className="gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="h-8 text-[12.5px]"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-8 gap-1.5 text-[12.5px]" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function EndpointDetails() {
  const { endpointId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['endpoint', endpointId],
    queryFn: () => getEndpoint(endpointId),
  });

  const toggleMutation = useMutation({
    mutationFn: () => updateEndpoint(endpointId, { isActive: !data.active }),
    onSuccess: (endpoint) => {
      queryClient.invalidateQueries({ queryKey: ['endpoint', endpointId] });
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
      toast({ title: endpoint.active ? 'Endpoint activated' : 'Endpoint paused' });
    },
    onError: (mutationError) =>
      toast({ variant: 'destructive', title: 'Update failed', description: mutationError.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEndpoint(endpointId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Endpoint deleted' });
      navigate('/endpoints');
    },
    onError: (mutationError) =>
      toast({ variant: 'destructive', title: 'Delete failed', description: mutationError.message }),
  });

  if (isError) {
    return (
      <>
        <PageHeader title="Endpoint" backTo="/endpoints" backLabel="Endpoints" />
        <ErrorState title="Unable to load endpoint" message={error?.message} onRetry={refetch} />
      </>
    );
  }

  if (!isLoading && !data) {
    return (
      <>
        <PageHeader title="Endpoint" backTo="/endpoints" backLabel="Endpoints" />
        <NotFoundState title="Endpoint not found" backTo="/endpoints" backLabel="Back to endpoints" />
      </>
    );
  }

  return (
    <div>
      <PageHeader
        backTo="/endpoints"
        backLabel="Endpoints"
        title={
          <span className="break-all font-mono text-[16px] leading-6 tracking-[-0.01em]">
            {isLoading ? 'Loading…' : data.url.replace('https://', '')}
          </span>
        }
        meta={data && <StatusBadge status={data.active ? 'active' : 'inactive'} />}
        description={data?.description}
        actions={
          data && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-[12.5px]"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-[12.5px]"
                onClick={() => toggleMutation.mutate()}
                disabled={toggleMutation.isPending}
              >
                <Power className="h-3.5 w-3.5" strokeWidth={1.75} />
                {data.active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-[12.5px] text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                Delete
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Deliveries" value={isLoading ? '—' : formatNumber(data.stats.deliveries)} hint="All attempts" />
        <StatTile label="Delivered" value={isLoading ? '—' : formatNumber(data.stats.delivered)} hint="Successful responses" />
        <StatTile label="Failed" value={isLoading ? '—' : formatNumber(data.stats.failed)} hint="Exhausted retries" />
        <StatTile
          label="Success rate"
          value={isLoading ? '—' : formatPercent(data.stats.success_rate, 1)}
          hint="Recent delivery health"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Recent deliveries" description="Latest attempts to this endpoint" bodyClassName="p-0">
          <DeliveriesTable
            deliveries={data?.recentDeliveries ?? []}
            loading={isLoading}
            showProject={false}
            emptyTitle="No deliveries to this endpoint yet"
          />
        </Panel>

        <Panel title="Endpoint details">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <DetailList
              items={[
                { label: 'Endpoint ID', value: data.id, mono: true },
                { label: 'Project', value: data.project_name },
                { label: 'Status', value: <StatusBadge status={data.active ? 'active' : 'inactive'} /> },
                { label: 'Created', value: formatDate(data.created_at) },
                { label: 'Last response', value: data.last_status ?? '—', mono: true },
                { label: 'Average duration', value: formatDuration(data.stats.average_duration), mono: true },
                { label: 'Signing secret', value: 'Not readable after creation' },
              ]}
            />
          )}
        </Panel>
      </div>

      <EditEndpointDialog open={editOpen} onOpenChange={setEditOpen} endpoint={data} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this endpoint?"
        description={`${data?.url ?? ''} will stop receiving events immediately. Existing delivery records are retained for auditing.`}
        confirmLabel="Delete endpoint"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}