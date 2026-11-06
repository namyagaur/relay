import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, MoreHorizontal, Plus } from 'lucide-react';
import { formatDate, formatNumber, relativeTime } from '@/utils/format';
import { listApiKeys, revokeApiKey } from '@/services/api/apiKeys';
import PageHeader from '@/components/shared/PageHeader';
import Panel from '@/components/shared/Panel';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import CreateKeyDialog from '@/components/api-keys/CreateKeyDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';

export default function ApiKeys() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['api-keys'],
    queryFn: listApiKeys,
  });

  const mutation = useMutation({
    mutationFn: (keyId) => revokeApiKey(keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setPendingRevoke(null);
      toast({ title: 'API key revoked', description: `${pendingRevoke?.name ?? 'The key'} can no longer authenticate requests.` });
    },
    onError: (mutationError) =>
      toast({ variant: 'destructive', title: 'Revoke failed', description: mutationError.message }),
  });

  const keys = data?.items ?? [];

  const columns = [
    {
      key: 'name',
      header: 'Key name',
      render: (key) => (
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-muted text-muted-foreground">
            <KeyRound className="h-3 w-3" strokeWidth={1.75} />
          </span>
          <span className="text-[12.5px] font-medium text-foreground">{key.name}</span>
        </div>
      ),
    },
    {
      key: 'masked_key',
      header: 'Key',
      render: (key) => <span className="font-mono text-[11px] text-muted-foreground">{key.masked_key}</span>,
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (key) => (
        <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">{formatDate(key.created_at)}</span>
      ),
    },
    {
      key: 'last_used_at',
      header: 'Last used',
      render: (key) => (
        <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">
          {key.last_used_at ? relativeTime(key.last_used_at) : 'Never'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (key) => <StatusBadge status={key.status} />,
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (key) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="API key actions">
                <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[168px]">
              <DropdownMenuItem
                className="text-[12.5px] text-destructive focus:text-destructive"
                disabled={key.status === 'revoked' || key.isCurrent}
                onSelect={() => setPendingRevoke(key)}
              >
                {key.status === 'revoked' ? 'Key revoked' : key.isCurrent ? 'Current session key' : 'Revoke key'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="API Keys"
        description="Manage API keys for the currently authenticated project."
        actions={
          <Button size="sm" className="h-8 gap-1.5 text-[12.5px]" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Create API key
          </Button>
        }
      />

      {isError ? (
        <ErrorState title="Unable to load API keys" message={error?.message} onRetry={refetch} />
      ) : (
        <Panel bodyClassName="p-0">
          <DataTable
            columns={columns}
            rows={keys}
            loading={isLoading}
            minWidth={760}
            empty={
              <EmptyState
                icon={KeyRound}
                title="No API keys yet"
                description="Create a project-scoped key to authenticate Relay API requests."
                action={
                  <Button size="sm" className="h-8 text-[12.5px]" onClick={() => setCreateOpen(true)}>
                    Create API key
                  </Button>
                }
              />
            }
          />
          {!isLoading && keys.length > 0 && (
            <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
              {formatNumber(keys.filter((key) => key.status === 'active').length)} active keys · raw keys are shown once
              at creation and cannot be retrieved later.
            </p>
          )}
        </Panel>
      )}

      <CreateKeyDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        open={Boolean(pendingRevoke)}
        onOpenChange={(next) => !next && setPendingRevoke(null)}
        title="Revoke API key?"
        description={`${pendingRevoke?.name ?? 'This key'} will stop working immediately. Any application still using it will receive 401 responses.`}
        confirmLabel="Revoke key"
        destructive
        loading={mutation.isPending}
        onConfirm={() => pendingRevoke && mutation.mutate(pendingRevoke.id)}
      />
    </div>
  );
}