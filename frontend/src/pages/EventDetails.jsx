import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RotateCcw } from 'lucide-react';
import { formatDateTime, formatNumber } from '@/utils/format';
import { getEvent, replayEvent } from '@/services/api/events';
import PageHeader from '@/components/shared/PageHeader';
import Panel from '@/components/shared/Panel';
import StatusBadge from '@/components/shared/StatusBadge';
import DetailList from '@/components/shared/DetailList';
import JsonViewer from '@/components/shared/JsonViewer';
import CopyButton from '@/components/shared/CopyButton';
import StatTile from '@/components/shared/StatTile';
import DataTable from '@/components/shared/DataTable';
import NotFoundState from '@/components/shared/NotFoundState';
import ErrorState from '@/components/shared/ErrorState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';

export default function EventDetails() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => getEvent(eventId),
  });

  const mutation = useMutation({
    mutationFn: () => replayEvent(eventId),
    onSuccess: () => {
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Replay queued', description: 'Relay accepted the event replay request.' });
    },
    onError: (mutationError) =>
      toast({ variant: 'destructive', title: 'Replay failed', description: mutationError.message }),
  });

  if (isError) {
    return (
      <>
        <PageHeader title="Event" backTo="/events" backLabel="Events" />
        <ErrorState title="Unable to load event" message={error?.message} onRetry={refetch} />
      </>
    );
  }

  if (!isLoading && !data) {
    return (
      <>
        <PageHeader title="Event" backTo="/events" backLabel="Events" />
        <NotFoundState title="Event not found" backTo="/events" backLabel="Back to events" />
      </>
    );
  }

  const deliveries = data?.deliveries ?? [];
  const totalAttempts = deliveries.reduce((sum, delivery) => sum + delivery.attempts.length, 0);
  const successfulAttempts = deliveries.reduce(
    (sum, delivery) => sum + delivery.attempts.filter((attempt) => attempt.status === 'delivered').length,
    0,
  );
  const failedAttempts = totalAttempts - successfulAttempts;

  const deliveryColumns = [
    {
      key: 'endpoint_url',
      header: 'Endpoint',
      render: (delivery) => (
        <span className="block max-w-[260px] truncate font-mono text-[11px] text-foreground">
          {delivery.endpoint_url.replace('https://', '')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (delivery) => <StatusBadge status={delivery.status} />,
    },
    {
      key: 'http_status',
      header: 'HTTP',
      render: (delivery) => (
        <span
          className={`font-mono text-[11.5px] tabular-nums ${
            delivery.http_status && delivery.http_status >= 400 ? 'text-danger' : 'text-success'
          }`}
        >
          {delivery.http_status ?? '—'}
        </span>
      ),
    },
    {
      key: 'attempt_count',
      header: 'Attempts',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (delivery) => (
        <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">{delivery.attempt_count}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        backTo="/events"
        backLabel="Events"
        title={isLoading ? 'Loading event…' : data.type}
        description={data ? `Received ${formatDateTime(data.created_at)}` : undefined}
        meta={data && <StatusBadge status={data.status} />}
        actions={
          data && (
            <>
              <CopyButton value={data.id} label="Copy ID" variant="outline" className="h-8" />
              <Button size="sm" className="h-8 gap-1.5 text-[12.5px]" onClick={() => setConfirmOpen(true)}>
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                Replay event
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel
            title="Event payload"
            description="JSON body delivered to each endpoint"
            action={data && <CopyButton value={data.payload} label="Copy JSON" />}
            bodyClassName="p-4"
          >
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-3.5 w-full" />
                ))}
              </div>
            ) : (
              <JsonViewer data={data.payload} maxHeight={420} className="rounded-lg bg-elevated p-3" />
            )}
          </Panel>

          <Panel
            title="Delivery targets"
            description={`${deliveries.length} delivery record${deliveries.length === 1 ? '' : 's'} for this event`}
            bodyClassName="p-0"
          >
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 2 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-full" />
                ))}
              </div>
            ) : deliveries.length ? (
              <DataTable
                columns={deliveryColumns}
                rows={deliveries}
                minWidth={620}
                skeletonRows={0}
                onRowClick={(delivery) => navigate(`/deliveries/${delivery.id}`)}
                empty={null}
              />
            ) : (
              <p className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
                No delivery targets were matched for this event.
              </p>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Event information">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-4 w-full" />
                ))}
              </div>
            ) : (
              <DetailList
                items={[
                  { label: 'Event ID', value: data.id, mono: true },
                  { label: 'Project', value: data.project_name },
                  { label: 'Event type', value: data.type, mono: true },
                  { label: 'Created', value: formatDateTime(data.created_at) },
                  { label: 'Status', value: <StatusBadge status={data.status} /> },
                ]}
              />
            )}
          </Panel>

          <Panel title="Delivery summary" description="Across all attempts">
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Attempts" value={isLoading ? '—' : formatNumber(totalAttempts)} />
              <StatTile label="Succeeded" value={isLoading ? '—' : formatNumber(successfulAttempts)} />
              <StatTile label="Failed" value={isLoading ? '—' : formatNumber(failedAttempts)} />
            </div>
            <p className="mt-3 text-[11.5px] leading-5 text-muted-foreground">
              Replaying re-sends this event to every matched endpoint and adds a new attempt to each delivery.
            </p>
            {!isLoading && data && (
              <Button asChild variant="outline" size="sm" className="mt-3 h-8 w-full text-[12px]">
                <Link to={`/deliveries?search=${data.id}`}>View deliveries for this event</Link>
              </Button>
            )}
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Replay this event?"
        description={`Relay will re-send ${data?.type ?? 'this event'} to every matched endpoint and record a new delivery attempt. Existing records are kept.`}
        confirmLabel={mutation.isPending ? 'Replaying…' : 'Replay event'}
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
      />

      {mutation.isPending && (
        <div className="mt-3 flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending replay request…
        </div>
      )}
    </div>
  );
}