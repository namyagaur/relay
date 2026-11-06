import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';

export default function NotFoundState({
  title = 'Record not found',
  description = undefined,
  backTo = undefined,
  backLabel = undefined,
}) {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'prerender-status-code';
    meta.content = '404';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="rounded-xl border border-border bg-surface">
      <EmptyState
        icon={FileQuestion}
        title={title}
        description={description ?? 'This record may have been deleted, or the identifier is incorrect.'}
        action={
          backTo ? (
            <Button asChild variant="outline" size="sm" className="h-8 text-[12.5px]">
              <Link to={backTo}>{backLabel ?? 'Go back'}</Link>
            </Button>
          ) : null
        }
      />
    </div>
  );
}