import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { formatDateTime, formatDuration } from '@/utils/format';
import { getDelivery } from '@/services/api/deliveries';
import { replayEvent } from '@/services/api/events';
import PageHeader from '@/components/shared/PageHeader';
import Panel from '@/components/shared/Panel';
import StatusBadge from '@/components/shared/StatusBadge';
import DetailList from '@/components/shared/DetailList';
import CopyButton from '@/components/shared/CopyButton';
import NotFoundState from '@/components/shared/NotFoundState';
import ErrorState from '@/components/shared/ErrorState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import AttemptTimeline from '@/components/deliveries/AttemptTimeline';
import AttemptInspector from '@/components/deliveries/AttemptInspector';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';

export default function DeliveryDetails() {
  const { deliveryId } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['delivery', deliveryId],
    queryFn: () => getDelivery(deliveryId),
  });

  useEffect(() => {
    if (data?.attempts?.length) setSelectedAttempt(data.attempts[data.attempts.length - 1].number);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => replayEvent(data.event_id),
    onSuccess: () => {
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['delivery', deliveryId] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['event', data.event_id] });
      toast({ title: 'Replay queued', description: 'Relay accepted the event replay request.' });
    },
    onError: (mutationError) =>
      toast({ variant: 'destructive', title: 'Replay failed', description: mutationError.message }),
  });

  if (isError) {
    return (
      <>
        <PageHeader title="Delivery" backTo="/deliveries" backLabel="Deliveries" />
        <ErrorState title="Unable to load delivery" message={error?.message} onRetry={refetch} />
      </>
    );
  }

  if (!isLoading && !data) {
    return (
      <>
        <PageHeader title="Delivery" backTo="/deliveries" backLabel="Deliveries" />
        <NotFoundState title="Delivery not found" backTo="/deliveries" backLabel="Back to deliveries" />
      </>
    );
  }

  const attempt = data?.attempts?.find((entry) => entry.number === selectedAttempt) ?? null;

  return (
    <div>
      <PageHeader
        backTo="/deliveries"
        backLabel="Deliveries"
        title={
          <span className="font-mono text-[19px] tracking-[-0.01em]">{isLoading ? 'Loading…' : data.id}</span>
        }
        meta={data && <StatusBadge status={data.status} />}
        description={
          data
            ? `${data.endpoint_url.replace('https://', '')} · ${data.event_type} · last attempt ${formatDateTime(
                data.last_attempt_at,
              )}`
            : undefined
        }
        actions={
          data && (
            <>
              <CopyButton value={data.id} label="Copy ID" variant="outline" className="h-8" />
              <Button
                size="sm"
                className="h-8 gap-1.5 text-[12.5px]"
                onClick={() => setConfirmOpen(true)}
                disabled={data.event_status === 'delivered'}
              >
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
            title="Attempt timeline"
            description="Every attempt Relay made to deliver this event"
            bodyClassName="p-4"
          >
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="md:border-r md:border-border md:pr-3">
                  <AttemptTimeline
                    attempts={data.attempts}
                    selected={selectedAttempt}
                    onSelect={setSelectedAttempt}
                  />
                </div>
                <div>
                  {attempt ? (
                    <AttemptInspector attempt={attempt} />
                  ) : (
                    <div className="grid h-full place-items-center rounded-lg border border-dashed border-border px-4 py-12 text-center text-[12.5px] text-muted-foreground">
                      Select an attempt to inspect its request and response.
                    </div>
                  )}
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Endpoint response history" description="Latest HTTP result per attempt">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : data.attempts.length ? (
              <ul className="divide-y divide-border">
                {data.attempts.map((entry) => (
                  <li key={entry.number} className="flex flex-wrap items-center gap-2 py-2 text-[11.5px] first:pt-0 last:pb-0">
                    <span className="w-16 shrink-0 font-mono text-muted-foreground">#{entry.number}</span>
                    <span
                      className={`font-mono tabular-nums ${
                        entry.http_status >= 400 ? 'text-danger' : 'text-success'
                      }`}
                    >
                      HTTP {entry.http_status}
                    </span>
                    <span className="text-muted-foreground">{entry.error ?? 'Accepted'}</span>
                    <span className="ml-auto font-mono tabular-nums text-muted-foreground">
                      {formatDuration(entry.duration_ms)}
                    </span>
                    <span className="w-[136px] text-right font-mono text-muted-foreground">
                      {formatDateTime(entry.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-[12.5px] text-muted-foreground">No attempts recorded.</p>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Delivery information">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-4 w-full" />
                ))}
              </div>
            ) : (
              <DetailList
                items={[
                  { label: 'Delivery ID', value: data.id, mono: true },
                  {
                    label: 'Event',
                    value: (
                      <Link to={`/events/${data.event_id}`} className="font-mono text-[11.5px] text-brand hover:underline">
                        {data.event_id}
                      </Link>
                    ),
                  },
                  {
                    label: 'Endpoint',
                    value: (
                      <Link
                        to={`/endpoints/${data.endpoint_id}`}
                        className="block max-w-[190px] truncate font-mono text-[11.5px] text-brand hover:underline"
                      >
                        {data.endpoint_url.replace('https://', '')}
                      </Link>
                    ),
                  },
                  { label: 'Project', value: data.project_name },
                  { label: 'Attempts', value: data.attempt_count, mono: true },
                  { label: 'Event created', value: formatDateTime(data.event_created_at) },
                  { label: 'Last attempt', value: formatDateTime(data.last_attempt_at) },
                ]}
              />
            )}
          </Panel>

          <Panel title="Retries and replays">
            <div className="space-y-2.5 text-[11.5px] leading-5 text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Automatic retry</span> — Relay retries failed deliveries on
                an exponential backoff schedule until the attempt budget is exhausted. Each retry is a new attempt in
                this timeline.
              </p>
              <p>
                <span className="font-medium text-foreground">Manual replay</span> — re-sends the original event to every
                matched endpoint immediately. Existing delivery history is preserved.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 h-8 w-full text-[12px]"
              onClick={() => setConfirmOpen(true)}
              disabled={!data || data.event_status === 'delivered'}
            >
              Replay event now
            </Button>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Replay this event?"
        description={`Relay will re-send ${data?.event_type ?? 'this event'} to ${
          data ? data.endpoint_url : 'its endpoints'
        } and record a new attempt. Automatic retries continue independently.`}
        confirmLabel={mutation.isPending ? 'Replaying…' : 'Replay event'}
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
      />
    </div>
  );
}