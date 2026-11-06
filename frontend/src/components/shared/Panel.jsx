import { cn } from '@/lib/utils';

export default function Panel({
  title = undefined,
  description = undefined,
  action = undefined,
  children,
  className = undefined,
  bodyClassName = undefined,
  id = undefined,
}) {
  return (
    <section
      id={id}
      className={cn('overflow-hidden rounded-xl border border-border bg-surface surface-shadow', className)}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-[18px]">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[12.5px] font-semibold tracking-[-0.006em] text-foreground">{title}</h2>
            )}
            {description && (
              <p className="mt-[3px] text-[11.5px] leading-4 text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn('px-4 py-[14px] sm:px-[18px]', bodyClassName)}>{children}</div>
    </section>
  );
}