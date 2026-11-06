import { cn } from '@/lib/utils';
import { formatNumber, formatPercent } from '@/utils/format';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function MetricCard({
  label,
  value,
  icon: Icon = undefined,
  hint = undefined,
  trend = undefined,
  loading = false,
  className = undefined,
}) {
  const hasTrend = trend && typeof trend.value === 'number' && Number.isFinite(trend.value);
  const TrendIcon = hasTrend && trend.value < 0 ? ArrowDownRight : ArrowUpRight;
  const trendTone = !hasTrend
    ? 'text-muted-foreground'
    : trend.positiveIsGood === false
      ? trend.value >= 0
        ? 'text-danger'
        : 'text-success'
      : trend.value >= 0
        ? 'text-success'
        : 'text-danger';

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface px-3.5 py-3.5 surface-shadow transition-colors duration-150 hover:border-input/70',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" strokeWidth={1.75} />}
      </div>

      {loading ? (
        <Skeleton className="mt-2.5 h-6 w-16" />
      ) : (
        <p className="mt-2 font-heading text-[24px] font-semibold leading-none tracking-[-0.032em] tabular-nums text-foreground">
          {typeof value === 'number' ? formatNumber(value) : value ?? '—'}
        </p>
      )}

      <div className="mt-[7px] flex min-h-[15px] items-center gap-1.5 text-[11px]">
        {hasTrend && (
          <span className={cn('inline-flex items-center gap-[3px] font-medium tabular-nums', trendTone)}>
            <TrendIcon className="h-[11px] w-[11px]" strokeWidth={2.25} />
            {formatPercent(Math.abs(trend.value), 1)}
          </span>
        )}
        {hint && <span className="truncate text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}