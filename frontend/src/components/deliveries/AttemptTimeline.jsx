import { cn } from '@/lib/utils';
import { formatDuration, formatShortDateTime } from '@/utils/format';

export default function AttemptTimeline({ attempts = [], selected, onSelect }) {
  if (!attempts.length) {
    return <p className="py-6 text-center text-[12px] text-muted-foreground">No attempts recorded yet.</p>;
  }

  return (
    <ol className="relative">
      {attempts.map((attempt, index) => {
        const isSelected = selected === attempt.number;
        const isLast = index === attempts.length - 1;
        return (
          <li key={attempt.number} className="relative pl-5">
            {!isLast && <span className="absolute left-[5px] top-4 h-[calc(100%-6px)] w-px bg-border" aria-hidden="true" />}
            <span
              className={cn(
                'absolute left-0 top-[9px] h-[11px] w-[11px] rounded-full border-2 bg-surface',
                attempt.status === 'delivered' ? 'border-success' : 'border-danger',
                isSelected && 'ring-2 ring-brand/30',
              )}
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => onSelect(attempt.number)}
              aria-pressed={isSelected}
              className={cn(
                'mb-1 w-full rounded-lg border px-2.5 py-2 text-left transition-colors',
                isSelected
                  ? 'border-input bg-accent'
                  : 'border-transparent hover:bg-accent',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-foreground">Attempt {attempt.number}</span>
                <span
                  className={cn(
                    'font-mono text-[11px] tabular-nums',
                    attempt.status === 'delivered' ? 'text-success' : 'text-danger',
                  )}
                >
                  HTTP {attempt.http_status}
                </span>
                <span className="ml-auto text-[10.5px] capitalize text-muted-foreground">{attempt.status}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                <span className="font-mono tabular-nums">{formatDuration(attempt.duration_ms)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatShortDateTime(attempt.timestamp)}</span>
                {attempt.error && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{attempt.error}</span>
                  </>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}