import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PageHeader({
  title,
  description = undefined,
  actions = undefined,
  backTo = undefined,
  backLabel = 'Back',
  meta = undefined,
  className = undefined,
}) {
  return (
    <div className={cn('mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {backTo && (
          <Link
            to={backTo}
            className="mb-1.5 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" strokeWidth={2} />
            {backLabel}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[23px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">{title}</h1>
          {meta}
        </div>
        {description && (
          <p className="mt-1 max-w-2xl text-[12.5px] leading-[1.55] text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}