import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatPercent, relativeTime } from '@/utils/format';
import { Skeleton } from '@/components/ui/skeleton';

const healthTone = (rate) => (rate >= 95 ? 'bg-success' : rate >= 82 ? 'bg-warning' : 'bg-danger');

export default function EndpointHealthList({ endpoints = [], loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3.5 w-52" />
            <Skeleton className="h-1 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!endpoints.length) {
    return <p className="py-8 text-center text-[12.5px] text-muted-foreground">No endpoints registered yet.</p>;
  }

  return (
    <div className="divide-y divide-border">
      {endpoints.map((endpoint) => (
        <Link
          key={endpoint.id}
          to={`/endpoints/${endpoint.id}`}
          className="group flex flex-col gap-1.5 py-3 transition-colors first:pt-0 last:pb-0"
        >
          <div className="flex items-center gap-2">
            <span
              className={cn('h-1.5 w-1.5 shrink-0 rounded-full', endpoint.active ? 'bg-success' : 'bg-muted-foreground/50')}
              aria-hidden="true"
            />
            <span className="truncate font-mono text-[11.5px] text-foreground group-hover:text-brand">
              {endpoint.url.replace('https://', '')}
            </span>
            <span
              className={cn(
                'ml-auto shrink-0 font-mono text-[11px] tabular-nums',
                endpoint.last_status && endpoint.last_status >= 400 ? 'text-danger' : 'text-success',
              )}
            >
              {endpoint.last_status ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                {endpoint.success_rate != null && (
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', healthTone(endpoint.success_rate))}
                    style={{ width: `${Math.max(3, endpoint.success_rate)}%` }}
                  />
                )}
              </div>
              <span className="w-11 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {endpoint.success_rate == null ? '—' : formatPercent(endpoint.success_rate, 1)}
              </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {endpoint.project_name}
            {endpoint.last_delivery_at ? ` · last delivery ${relativeTime(endpoint.last_delivery_at)}` : ' · no deliveries yet'}
          </p>
        </Link>
      ))}
    </div>
  );
}