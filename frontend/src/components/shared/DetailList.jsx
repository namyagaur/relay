import { cn } from '@/lib/utils';

export default function DetailList({ items, className = undefined }) {
  return (
    <dl className={cn('divide-y divide-border', className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0">
          <dt className="shrink-0 text-[11.5px] text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              'min-w-0 break-words text-right text-[12px] text-foreground',
              item.mono && 'font-mono text-[11.5px]',
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}