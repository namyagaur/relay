import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';

/** @type {Array<{value: 'light' | 'dark' | 'system', label: string, icon: import('lucide-react').LucideIcon}>} */
export const APPEARANCES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeSegmented({ className = undefined }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className={cn('flex items-center gap-[2px] rounded-[7px] bg-foreground/[0.05] p-[2px]', className)}>
      {APPEARANCES.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-label={`${option.label} appearance`}
            aria-pressed={active}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className={cn(
              'flex h-[22px] flex-1 items-center justify-center gap-1.5 rounded-[5px] text-[10.5px] font-medium transition-all duration-150',
              active
                ? 'bg-surface text-foreground shadow-[0_1px_2px_hsl(0_0%_9%/0.08)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3 w-3" strokeWidth={1.75} />
            <span className="hidden xl:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ThemeMenu() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const Icon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label="Change appearance"
        >
          <Icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[168px]">
        {APPEARANCES.map((option) => {
          const OptionIcon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value)}
              className="gap-2 text-[12.5px]"
            >
              <OptionIcon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
              {option.label}
              {theme === option.value && <Check className="ml-auto h-3.5 w-3.5 text-brand" strokeWidth={2} />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}