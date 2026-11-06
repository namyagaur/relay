import { Link } from 'react-router-dom';
import { relativeTime } from '@/utils/format';
import StatusBadge from '@/components/shared/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';

export default function RecentEventsTable({ events = [], loading }) {
  if (loading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!events.length) {
    return <p className="py-8 text-center text-[12.5px] text-muted-foreground">No events in this period.</p>;
  }

  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
        <thead>
          <tr className="text-left text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
            <th className="px-4 py-2 font-medium sm:px-5">Event</th>
            <th className="px-3 py-2 font-medium">Project</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-4 py-2 text-right font-medium sm:px-5">Created</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="group border-t border-border transition-colors hover:bg-accent">
              <td className="px-4 py-2.5 sm:px-5">
                <Link to={`/events/${event.id}`} className="block">
                  <span className="block font-mono text-[11.5px] text-foreground">{event.id}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{event.type}</span>
                </Link>
              </td>
              <td className="max-w-[150px] truncate px-3 py-2.5 text-muted-foreground">{event.project_name}</td>
              <td className="px-3 py-2.5">
                <StatusBadge status={event.status} />
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right text-[11.5px] text-muted-foreground sm:px-5">
                {relativeTime(event.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}