import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Command } from 'cmdk';
import { CornerDownLeft, Search } from 'lucide-react';
import { ALL_NAV } from '@/constants/navigation';
import { searchAll } from '@/services/api/search';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const TYPE_ORDER = ['Project', 'Event', 'Delivery', 'Endpoint'];

const GROUP_HEADING =
  '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-muted-foreground/80';

export default function CommandMenu({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');

  useEffect(() => {
    if (!open) setTerm('');
  }, [open]);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['search', term],
    queryFn: () => searchAll(term),
    enabled: open && term.trim().length >= 2,
    staleTime: 15000,
  });

  const results = data?.items ?? [];
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: results.filter((item) => item.type === type),
  })).filter((group) => group.items.length > 0);

  const go = (path) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pop-shadow top-[14%] max-w-[572px] translate-y-0 gap-0 overflow-hidden rounded-xl border-border bg-popover p-0">
        <DialogTitle className="sr-only">Search Relay</DialogTitle>
        <Command shouldFilter={false} loop className="flex flex-col">
          <div className="flex items-center gap-2.5 border-b border-border/70 px-3.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground/70" strokeWidth={1.75} />
            <Command.Input
              value={term}
              onValueChange={setTerm}
              placeholder="Search events, deliveries, endpoints, projects…"
              className="h-11 w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/80"
            />
            <kbd className="shrink-0 rounded-[5px] border border-border bg-elevated px-1.5 font-mono text-[10px] leading-[16px] text-muted-foreground">
              esc
            </kbd>
          </div>

          <Command.List className="max-h-[356px] overflow-y-auto scrollbar-thin p-1.5">
            <Command.Empty className="px-3 py-10 text-center text-[12px] text-muted-foreground">
              {isFetching
                ? 'Searching…'
                : isError
                  ? error?.message ?? 'Search is unavailable.'
                  : term.trim().length >= 2
                    ? 'No matches found.'
                    : 'Type to search or jump to a page.'}
            </Command.Empty>

            <Command.Group heading="Navigate" className={GROUP_HEADING}>
              {ALL_NAV.map((item) => (
                <Command.Item
                  key={item.to}
                  value={`page ${item.label}`}
                  onSelect={() => go(item.to)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[6px] px-2 py-[7px] text-[12.5px] text-foreground outline-none transition-colors data-[selected=true]:bg-accent"
                >
                  <item.icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>

            {grouped.map((group) => (
              <Command.Group
                key={group.type}
                heading={group.type === 'Delivery' ? 'Deliveries' : `${group.type}s`}
                className={GROUP_HEADING}
              >
                {group.items.map((item) => (
                  <Command.Item
                    key={`${item.type}-${item.id}`}
                    value={`${item.type} ${item.label}`}
                    onSelect={() => go(item.to)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[6px] px-2 py-[7px] outline-none transition-colors data-[selected=true]:bg-accent"
                  >
                    <span className="font-mono text-[11px] text-foreground">{item.label}</span>
                    {item.subtitle && (
                      <span className="truncate text-[11.5px] text-muted-foreground">{item.subtitle}</span>
                    )}
                    <CornerDownLeft className="ml-auto h-3 w-3 shrink-0 text-muted-foreground/60" />
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>

          <div className="flex items-center gap-4 border-t border-border/70 px-3.5 py-1.5 text-[10.5px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded-[4px] border border-border bg-elevated px-1 font-mono">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded-[4px] border border-border bg-elevated px-1 font-mono">↵</kbd> open
            </span>
            <span className="ml-auto">{results.length > 0 ? `${results.length} results` : 'Relay'}</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}