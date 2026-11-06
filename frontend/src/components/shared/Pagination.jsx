import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Pagination({ page = 1, pageCount = 1, total = 0, pageSize = 10, onPage }) {
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[11.5px] text-muted-foreground">
      <span className="font-mono tabular-nums">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Button>
        <span className="min-w-[54px] text-center font-mono tabular-nums">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Button>
      </div>
    </div>
  );
}