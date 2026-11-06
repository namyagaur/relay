import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, FolderGit2, Loader2, Plus } from 'lucide-react';
import { formatDate, formatNumber, formatPercent } from '@/utils/format';
import { createProject, listProjects } from '@/services/api/projects';
import CopyButton from '@/components/shared/CopyButton';
import PageHeader from '@/components/shared/PageHeader';
import Panel from '@/components/shared/Panel';
import SearchInput from '@/components/shared/SearchInput';
import DataTable from '@/components/shared/DataTable';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

function CreateProjectDialog({ open, onOpenChange }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [createdProject, setCreatedProject] = useState(null);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCreatedProject(project);
      toast({ title: 'Project created', description: 'Copy the initial API key before closing.' });
      setError('');
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const close = () => {
    setName('');
    setCreatedProject(null);
    setError('');
    onOpenChange(false);
  };

  const submit = (event) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError('Project name must be at least 2 characters.');
      return;
    }
    setError('');
    mutation.mutate({ name: name.trim() });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-[440px] border-border bg-surface">
        {createdProject ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-[16px] font-semibold tracking-[-0.02em]">Project created</DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground">
                Copy the initial API key now. Relay will not show it again.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-border bg-elevated p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                  {createdProject.name}
                </p>
                <CopyButton value={createdProject.apiKey} label="Copy key" />
              </div>
              <p className="mt-1.5 break-all font-mono text-[11.5px] text-foreground">{createdProject.apiKey}</p>
            </div>
            <div className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[11.5px] leading-5 text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Use this key to access the new project. Project data is scoped to its key.
            </div>
            <DialogFooter>
              <Button className="h-8 gap-1.5 text-[12.5px]" onClick={close}>
                <Check className="h-3.5 w-3.5" strokeWidth={2} />
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-[16px] font-semibold tracking-[-0.02em]">Create project</DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground">
                Each project has its own API key and isolated event data.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={submit} className="space-y-3.5">
          <div>
            <Label htmlFor="project-name" className="text-[12px] text-foreground">
              Project name
            </Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Acme Production"
              autoFocus
              className="mt-1.5 h-9 text-[13px]"
            />
            {error && <p className="mt-1.5 text-[11.5px] text-destructive">{error}</p>}
            </div>

            <DialogFooter className="gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="h-8 text-[12.5px]"
              onClick={close}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-8 gap-1.5 text-[12.5px]" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create project
            </Button>
            </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });

  const projects = (data?.items ?? []).filter((project) =>
    `${project.name} ${project.id}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const columns = [
    {
      key: 'name',
      header: 'Project',
      render: (project) => (
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-foreground">{project.name}</p>
          <p className="mt-0.5 max-w-[320px] truncate font-mono text-[10.5px] text-muted-foreground">{project.id}</p>
        </div>
      ),
    },
    {
      key: 'event_count',
      header: 'Events',
      sortable: true,
      className: 'text-right',
      headerClassName: 'text-right',
      render: (project) => (
        <span className="font-mono text-[11.5px] tabular-nums text-foreground">{formatNumber(project.event_count)}</span>
      ),
    },
    {
      key: 'endpoint_count',
      header: 'Endpoints',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (project) => (
        <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">{project.endpoint_count}</span>
      ),
    },
    {
      key: 'success_rate',
      header: 'Success rate',
      render: (project) => (
        <div className="flex items-center gap-2">
          <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success" style={{ width: `${project.success_rate}%` }} />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatPercent(project.success_rate, 1)}
          </span>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (project) => (
        <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">{formatDate(project.created_at)}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Each API key accesses one project. New projects get their own one-time API key."
        actions={
          <Button size="sm" className="h-8 gap-1.5 text-[12.5px]" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Create project
          </Button>
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search projects…" className="sm:w-[280px]" />
      </div>

      <Panel bodyClassName="p-0">
        {isError ? (
          <ErrorState className="p-4" title="Unable to load projects" message={error?.message} onRetry={refetch} />
        ) : (
          <DataTable
            columns={columns}
            rows={projects}
            loading={isLoading}
            minWidth={820}
            onRowClick={(project) => navigate(`/projects/${project.id}`)}
            empty={
              <EmptyState
                icon={FolderGit2}
                title={search ? 'No projects match your search' : 'No projects yet'}
                description={
                  search
                    ? 'Try a different name or clear the search field.'
                    : 'Create your first project to start routing events to endpoints.'
                }
                action={
                  !search && (
                    <Button size="sm" className="h-8 text-[12.5px]" onClick={() => setCreateOpen(true)}>
                      Create project
                    </Button>
                  )
                }
              />
            }
          />
        )}
      </Panel>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}