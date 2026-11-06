import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Database, KeyRound, LogOut, Moon, Monitor, Sun, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme/ThemeProvider';
import { APPEARANCES } from '@/components/theme/ThemeControl';
import { API_BASE_URL } from '@/services/api/client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import Panel from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const SECTIONS = [
  { id: 'project', label: 'Project', icon: Terminal },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'integration', label: 'Integration', icon: Database },
  { id: 'session', label: 'Session', icon: KeyRound },
];

const APPEARANCE_ICONS = { Light: Sun, Dark: Moon, System: Monitor };

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { project, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [active, setActive] = useState('project');

  const signOut = () => {
    try {
      logout();
      navigate('/login', { replace: true });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Logout failed', description: error.message });
    }
  };

  return (
    <div>
      <PageHeader title="Settings" description="Project configuration and console preferences." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[188px_minmax(0,1fr)]">
        <nav aria-label="Settings sections">
          <ul className="flex gap-1 overflow-x-auto no-scrollbar lg:flex-col">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => setActive(section.id)}
                  aria-current={active === section.id ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors',
                    active === section.id
                      ? 'bg-accent font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <section.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-4">
          {active === 'project' && (
            <Panel title="Project" description="Identity of the project this API key is scoped to">
              <dl className="divide-y divide-border">
                {[
                  { label: 'Project name', value: project?.name ?? '—' },
                  { label: 'Project ID', value: project?.id ?? '—', mono: true },
                  { label: 'Created', value: project?.createdAt ? new Date(project.createdAt).toLocaleString() : '—' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
                    <dt className="text-[11.5px] text-muted-foreground">{row.label}</dt>
                    <dd className={cn('text-[12px] text-foreground', row.mono && 'font-mono text-[11.5px]')}>
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[11.5px] leading-5 text-muted-foreground">
                Data shown in this console is limited to this project. To access another project, sign out and enter one
                of its API keys.
              </p>
            </Panel>
          )}

          {active === 'appearance' && (
            <Panel title="Appearance" description="Choose how Relay looks on this device">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {APPEARANCES.map((option) => {
                  const Icon = APPEARANCE_ICONS[option.label] ?? Sun;
                  const selected = theme === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      aria-pressed={selected}
                      className={cn(
                        'flex flex-col items-start gap-2 rounded-lg border px-3 py-3 text-left transition-colors',
                        selected
                          ? 'border-brand bg-brand-soft'
                          : 'border-border bg-surface hover:bg-accent',
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <Icon
                          className={cn('h-4 w-4', selected ? 'text-brand' : 'text-muted-foreground')}
                          strokeWidth={1.75}
                        />
                        {selected && <Check className="h-3.5 w-3.5 text-brand" strokeWidth={2} />}
                      </div>
                      <div>
                        <p className="text-[12.5px] font-medium text-foreground">{option.label}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {option.value === 'system' ? 'Follow device setting' : `Always ${option.label.toLowerCase()}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11.5px] leading-5 text-muted-foreground">
                Your preference is stored on this device and applied before the first paint.
              </p>
            </Panel>
          )}

          {active === 'integration' && (
            <Panel title="Integration" description="How this console reaches the Relay service">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-3 py-2.5">
                  <div>
                    <p className="text-[12px] font-medium text-foreground">Data source</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Relay API
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-[3px] font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                    live
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-foreground">API base URL</p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      {API_BASE_URL || 'Not configured'}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-[3px] font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                    VITE_API_BASE_URL
                  </span>
                </div>
                <p className="text-[11.5px] leading-5 text-muted-foreground">
                  The API base URL is configured with{' '}
                  <span className="font-mono text-foreground">VITE_API_BASE_URL</span>.
                </p>
              </div>
            </Panel>
          )}

          {active === 'session' && (
            <Panel title="API-key session" description="This dashboard is authenticated with a project-scoped API key">
              <p className="text-[12.5px] leading-5 text-muted-foreground">
                The credential is kept in session storage for this browser tab and is sent only in the Authorization
                header. It is not available for retrieval after logout.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-8 gap-1.5 text-[12.5px]"
                onClick={signOut}
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                Log out
              </Button>
            </Panel>
          )}
        </div>
      </div>

    </div>
  );
}