import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry = undefined,
  className = undefined,
}) {
  return (
    <div className={className}>
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-14 text-center">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <p className="mt-3 text-[13.5px] font-medium text-foreground">{title}</p>
        {message && <p className="mt-1 max-w-sm text-[12.5px] leading-5 text-muted-foreground">{message}</p>}
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-4 h-8 gap-1.5 text-[12.5px]" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}