import { Link, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { NAV_GROUPS } from '@/constants/navigation';
import { listProjects } from '@/services/api/projects';
import RelayLogo from '@/components/layout/RelayLogo';
import { ThemeMenu, ThemeSegmented } from '@/components/theme/ThemeControl';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function WorkspaceSwitcher({ collapsed, onNavigate }) {
  const { project } = useAuth();
  const { data } = useQuery({ queryKey: ['projects', 'nav'], queryFn: () => listProjects(), staleTime: 60000 });
  const projects = data?.items ?? [];
  const projectName = project?.name ?? projects[0]?.name ?? 'Relay project';
  const initials = projectName.slice(0, 2).toUpperCase();

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/projects"
            onClick={onNavigate}
            className="mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-[7px] bg-foreground/[0.06] text-[10.5px] font-semibold text-foreground/80 transition-colors hover:bg-foreground/[0.09]"
            aria-label={`${projectName} project`}
          >
            {initials}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{projectName}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left transition-colors hover:bg-foreground/[0.045] data-[state=open]:bg-foreground/[0.06]"
        >
          <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] bg-foreground/[0.07] text-[9.5px] font-semibold text-foreground/80">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium leading-[17px] text-foreground">
              {projectName}
            </span>
            <span className="block truncate text-[10.5px] leading-[15px] text-muted-foreground">
              Project-scoped
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={5} className="w-[226px]">
        <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          Projects
        </DropdownMenuLabel>
        {projects.map((project) => (
          <DropdownMenuItem key={project.id} asChild className="text-[12.5px]">
            <Link to={`/projects/${project.id}`} onClick={onNavigate} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand/80" />
              <span className="truncate">{project.name}</span>
              <Check className="ml-auto h-3 w-3 text-transparent" />
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="text-[12.5px]">
          <Link to="/projects" onClick={onNavigate} className="flex items-center gap-2">
            <Plus className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
            Manage projects
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavItem({ item, collapsed, onNavigate }) {
  const link = (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex h-[30px] items-center gap-2.5 rounded-[7px] px-2 text-[12.5px] font-medium transition-colors duration-150',
          isActive
            ? 'bg-brand-soft text-foreground'
            : 'text-muted-foreground hover:bg-foreground/[0.035] hover:text-foreground',
          collapsed && 'justify-center px-0',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn(
              'h-4 w-4 shrink-0 transition-colors',
              isActive ? 'text-brand' : 'text-muted-foreground/80 group-hover:text-foreground',
            )}
            strokeWidth={1.75}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export default function Sidebar({ collapsed = false, onToggle, onNavigate }) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full w-full flex-col bg-sidebar">
        <div className={cn('flex h-12 shrink-0 items-center px-3.5', collapsed && 'justify-center px-0')}>
          <Link
            to="/"
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-[7px] outline-none"
            aria-label="Relay home"
          >
            <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-foreground text-background shadow-[inset_0_1px_0_hsl(0_0%_100%/0.14)]">
              <RelayLogo className="h-[15px] w-[15px]" />
            </span>
            {!collapsed && (
              <span className="text-[14px] font-semibold tracking-[-0.025em] text-foreground">Relay</span>
            )}
          </Link>
        </div>

        <div className={cn('px-2 pb-2', collapsed && 'px-1.5')}>
          <WorkspaceSwitcher collapsed={collapsed} onNavigate={onNavigate} />
        </div>

        <nav className={cn('flex-1 overflow-y-auto no-scrollbar px-2 pb-2', collapsed && 'px-1.5')}>
          {NAV_GROUPS.map((group, index) => (
            <div key={group.label} className={cn(index > 0 && 'mt-5')}>
              {!collapsed && (
                <p className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                  {group.label}
                </p>
              )}
              <div className="space-y-[2px]">
                {group.items.map((item) => (
                  <NavItem key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className={cn('shrink-0 px-2.5 pb-3 pt-2', collapsed && 'px-1.5')}>
          <div className="mb-2 h-px w-full bg-sidebar-border" aria-hidden="true" />
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <ThemeMenu />
              {onToggle && (
                <button
                  type="button"
                  onClick={onToggle}
                  aria-label="Expand sidebar"
                  className="grid h-7 w-7 place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                >
                  <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                Appearance
              </p>
              <ThemeSegmented />
              {onToggle && (
                <button
                  type="button"
                  onClick={onToggle}
                  className="mt-1.5 flex h-7 w-full items-center gap-2 rounded-[7px] px-2 text-[11.5px] text-muted-foreground transition-colors hover:bg-foreground/[0.035] hover:text-foreground"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Collapse sidebar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}