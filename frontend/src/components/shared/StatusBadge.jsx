import { cn } from '@/lib/utils';
import { STATUS_LABEL } from '@/constants/domain';

const STYLES = {
  delivered: 'bg-success-soft text-success',
  healthy: 'bg-success-soft text-success',
  active: 'bg-success-soft text-success',
  processing: 'bg-info-soft text-info',
  retrying: 'bg-warning-soft text-warning',
  pending: 'bg-warning-soft text-warning',
  inactive: 'bg-muted text-muted-foreground',
  failed: 'bg-danger-soft text-danger',
  failing: 'bg-danger-soft text-danger',
  degraded: 'bg-warning-soft text-warning',
  revoked: 'bg-muted text-muted-foreground',
};

const DOTS = {
  delivered: 'bg-success',
  healthy: 'bg-success',
  active: 'bg-success',
  processing: 'bg-info',
  retrying: 'bg-warning',
  pending: 'bg-warning',
  inactive: 'bg-muted-foreground/70',
  failed: 'bg-danger',
  failing: 'bg-danger',
  degraded: 'bg-warning',
  revoked: 'bg-muted-foreground/70',
};

export default function StatusBadge({ status, className = undefined, showDot = true }) {
  const key = String(status ?? '').toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[5px] px-[6px] py-[2px] text-[10.5px] font-medium leading-4',
        STYLES[key] ?? 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {showDot && (
        <span
          className={cn(
            'h-[5px] w-[5px] shrink-0 rounded-full',
            DOTS[key] ?? 'bg-muted-foreground',
            (key === 'processing' || key === 'retrying') && 'animate-pulse-soft',
          )}
        />
      )}
      {STATUS_LABEL[key] ?? key ?? 'Unknown'}
    </span>
  );
}