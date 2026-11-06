import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function DataTable({
  columns,
  rows = [],
  rowKey = (row, rowIndex) => row.id ?? rowIndex,
  onRowClick = undefined,
  sortKey = undefined,
  sortDir = 'desc',
  onSort = undefined,
  loading = false,
  skeletonRows = 7,
  empty = undefined,
  minWidth = 760,
}) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full border-collapse text-[12.5px]" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-border/70 bg-elevated/70">
            {columns.map((column) => {
              const key = column.sortKey ?? column.key;
              const active = sortKey === key;
              const canSort = Boolean(column.sortable && onSort);
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-3 py-[7px] text-left text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground first:pl-4 last:pr-4',
                    column.headerClassName,
                  )}
                >
                  {canSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(key)}
                      className={cn(
                        'inline-flex items-center gap-1 transition-colors hover:text-foreground',
                        active && 'text-foreground',
                      )}
                    >
                      {column.header}
                      {active ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="h-3 w-3" strokeWidth={2} />
                        ) : (
                          <ArrowDown className="h-3 w-3" strokeWidth={2} />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" strokeWidth={1.75} />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="border-b border-border last:border-0">
                  {columns.map((column, columnIndex) => (
                    <td key={column.key} className="px-3 py-3 first:pl-4 last:pr-4">
                      <Skeleton className={cn('h-3.5', columnIndex === 0 ? 'w-28' : 'w-16')} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row, rowIndex) => (
                <tr
                  key={rowKey(row, rowIndex)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === 'Enter') onRowClick(row);
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    'border-b border-border transition-colors last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn('px-3 py-2.5 align-middle first:pl-4 last:pr-4', column.className)}
                    >
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}

          {!loading && !rows.length && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-2">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}