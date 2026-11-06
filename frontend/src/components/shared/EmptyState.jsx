import { cn } from '@/lib/utils';

export default function EmptyState({
  icon: Icon = undefined,
  title,
  description = undefined,
  action = undefined,
  className = undefined,
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icon && (
        <span className="grid h-9 w-9 place-items-center rounded-full border border-border bg-elevated text-muted-foreground">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
      )}
      <p className="mt-3 text-[13px] font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[12px] leading-5 text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}