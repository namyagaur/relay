import DetailList from '@/components/shared/DetailList';
import { cn } from '@/lib/utils';
import StatusBadge from '@/components/shared/StatusBadge';
import JsonViewer from '@/components/shared/JsonViewer';
import CopyButton from '@/components/shared/CopyButton';
import { formatDateTime, formatDuration } from '@/utils/format';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function Block({ title, value, action = undefined }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground">{title}</p>
        {action}
      </div>
      <div className="rounded-lg border border-border bg-elevated p-3">
        <JsonViewer data={value} maxHeight={220} defaultDepth={1} />
      </div>
    </div>
  );
}

export default function AttemptInspector({ attempt }) {
  if (!attempt) {
    return (
      <div className="grid h-full place-items-center rounded-lg border border-dashed border-border px-4 py-12 text-[12.5px] text-muted-foreground">
        No attempt recorded for this delivery yet.
      </div>
    );
  }

  const failed = attempt.http_status >= 400;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <h3 className="text-[13px] font-semibold text-foreground">Attempt {attempt.number}</h3>
        <StatusBadge status={attempt.status} />
        <span className={cn('font-mono text-[11.5px] tabular-nums', failed ? 'text-danger' : 'text-success')}>
          HTTP {attempt.http_status}
        </span>
        <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
          {formatDuration(attempt.duration_ms)}
        </span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{formatDateTime(attempt.timestamp)}</span>
      </div>

      <Tabs defaultValue="request" className="mt-3">
        <TabsList className="h-8 bg-muted p-0.5">
          <TabsTrigger value="request" className="h-7 px-2.5 text-[11.5px]">
            Request
          </TabsTrigger>
          <TabsTrigger value="response" className="h-7 px-2.5 text-[11.5px]">
            Response
          </TabsTrigger>
          <TabsTrigger value="metadata" className="h-7 px-2.5 text-[11.5px]">
            Metadata
          </TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="mt-3 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-elevated px-2.5 py-2">
            <span className="rounded bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] font-medium text-brand">
              {attempt.request.method}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground">{attempt.request.url}</span>
            <CopyButton value={attempt.request.url} />
          </div>
          <Block
            title="Request payload"
            value={attempt.request.body}
            action={<CopyButton value={attempt.request.body} label="Copy" />}
          />
        </TabsContent>

        <TabsContent value="response" className="mt-3 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-elevated px-2.5 py-2 font-mono text-[11.5px]">
            <span className={cn('tabular-nums', failed ? 'text-danger' : 'text-success')}>{attempt.http_status}</span>
            <span className="text-muted-foreground">{attempt.error ?? 'OK'}</span>
            <span className="ml-auto text-muted-foreground">{formatDuration(attempt.response?.duration_ms ?? attempt.duration_ms)}</span>
          </div>
          <Block title="Response body" value={attempt.response?.body ?? {}} />
        </TabsContent>

        <TabsContent value="metadata" className="mt-3">
          <DetailList
            items={[
              { label: 'Attempt', value: `#${attempt.number}` },
              { label: 'Status', value: <StatusBadge status={attempt.status} /> },
              { label: 'HTTP status', value: attempt.http_status, mono: true },
              { label: 'Duration', value: formatDuration(attempt.duration_ms), mono: true },
              { label: 'Timestamp', value: formatDateTime(attempt.timestamp), mono: true },
              { label: 'Error', value: attempt.error ?? 'None' },
              { label: 'Request method', value: attempt.request?.method, mono: true },
            ]}
          />
          <p className="mt-3 text-[11.5px] leading-5 text-muted-foreground">
            Automatic retries are scheduled by Relay with exponential backoff. A manual replay creates a new attempt
            series and does not reset the automatic retry counter.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}