import { cn } from '@/lib/utils';

export default function StatTile({ label, value, hint = undefined, className = undefined }) {
  return (
    <div className={cn('rounded-lg border border-border bg-elevated px-3.5 py-3', className)}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-heading text-[20px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">
        {value}
      </p>
      {hint && <p className="mt-1.5 truncate text-[10.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}