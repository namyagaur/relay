import { formatNumber, formatPercent } from '@/utils/format';

const ROWS = [
  { key: 'delivered', label: 'Delivered', bar: 'bg-success', dot: 'bg-success' },
  { key: 'failed', label: 'Failed', bar: 'bg-danger', dot: 'bg-danger' },
  { key: 'retrying', label: 'Retrying', bar: 'bg-warning', dot: 'bg-warning' },
  { key: 'pending', label: 'Pending', bar: 'bg-warning', dot: 'bg-warning' },
];

export default function DeliveryHealth({ health, loading }) {
  const delivered = health?.delivered ?? 0;
  const failed = health?.failed ?? 0;
  const retrying = health?.retrying ?? 0;
  const pending = health?.pending ?? 0;
  const total = delivered + failed + retrying + pending;
  const pct = (value) => (total ? (value / total) * 100 : 0);

  return (
    <div>
      <p className="text-[11.5px] font-medium text-muted-foreground">Success rate</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="font-heading text-[32px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-foreground">
          {loading ? '—' : formatPercent(health?.successRate ?? 0, 1)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {loading ? '' : `of ${formatNumber(total)} deliveries`}
        </p>
      </div>

      <div
        className="mt-4 flex h-[6px] w-full gap-[2px] overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label="Delivery outcome distribution"
      >
        <div className="rounded-full bg-success transition-all duration-500" style={{ width: `${pct(delivered)}%` }} />
        <div className="rounded-full bg-danger transition-all duration-500" style={{ width: `${pct(failed)}%` }} />
        <div className="rounded-full bg-warning transition-all duration-500" style={{ width: `${pct(retrying)}%` }} />
        <div className="rounded-full bg-warning transition-all duration-500" style={{ width: `${pct(pending)}%` }} />
      </div>

      <div className="mt-4 divide-y divide-border/70">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center gap-2 py-[9px] text-[12px]">
            <span className={`h-1.5 w-1.5 rounded-full ${row.dot}`} />
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ml-auto font-mono text-[11.5px] tabular-nums text-foreground">
              {formatNumber(health?.[row.key] ?? 0)}
            </span>
            <span className="w-11 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatPercent(pct(health?.[row.key] ?? 0), 1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}