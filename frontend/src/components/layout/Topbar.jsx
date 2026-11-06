import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Menu, Search } from 'lucide-react';
import { getBreadcrumbs } from '@/constants/navigation';
import { ThemeMenu } from '@/components/theme/ThemeControl';
import { Button } from '@/components/ui/button';

const IS_MAC =
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.userAgent || '');

export default function Topbar({ onOpenMobile, onOpenSearch }) {
  const location = useLocation();
  const crumbs = getBreadcrumbs(location.pathname);

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-xl sm:px-5 lg:px-7">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground lg:hidden"
        onClick={onOpenMobile}
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" strokeWidth={1.75} />
      </Button>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[12px]">
        <Link
          to="/"
          className="hidden shrink-0 text-muted-foreground transition-colors hover:text-foreground sm:inline"
        >
          Relay
        </Link>
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="hidden h-3 w-3 shrink-0 text-muted-foreground/60 sm:inline" strokeWidth={2} />
            {crumb.to ? (
              <Link to={crumb.to} className="truncate text-muted-foreground transition-colors hover:text-foreground">
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-foreground">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenSearch}
          className="group hidden h-7 items-center gap-2 rounded-[7px] border border-border bg-surface px-2 text-[12px] text-muted-foreground transition-colors hover:border-input hover:text-foreground sm:flex sm:w-[218px]"
        >
          <Search className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={1.75} />
          <span className="truncate">Search</span>
          <kbd className="ml-auto shrink-0 rounded-[5px] border border-border bg-elevated px-1.5 font-mono text-[10px] leading-[16px] text-muted-foreground">
            {IS_MAC ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground sm:hidden"
          onClick={onOpenSearch}
          aria-label="Search"
        >
          <Search className="h-[15px] w-[15px]" strokeWidth={1.75} />
        </Button>
        <span className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
        <ThemeMenu />
      </div>
    </header>
  );
}