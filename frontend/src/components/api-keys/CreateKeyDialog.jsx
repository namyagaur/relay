import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { createApiKey } from '@/services/api/apiKeys';
import CopyButton from '@/components/shared/CopyButton';
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

export default function CreateKeyDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const mutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setCreated(key);
      toast({ title: 'API key created', description: 'Copy it now — it will not be shown again.' });
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const close = () => {
    setName('');
    setError('');
    setCreated(null);
    onOpenChange(false);
  };

  const submit = (event) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError('Give this key a descriptive name.');
      return;
    }
    setError('');
    mutation.mutate({ name: name.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-[460px] border-border bg-surface">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-[16px] font-semibold tracking-[-0.02em]">API key created</DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground">
                Use this key to authenticate requests to the Relay API.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-border bg-elevated p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                  {created.name}
                </p>
                <CopyButton value={created.full_key} label="Copy key" />
              </div>
              <p className="mt-1.5 break-all font-mono text-[11.5px] text-foreground">{created.full_key}</p>
            </div>

            <div className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[11.5px] leading-5 text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              This is the only time the full key is shown. Store it in your secret manager before closing.
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
              <DialogTitle className="text-[16px] font-semibold tracking-[-0.02em]">Create API key</DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground">
                This key is scoped to the currently authenticated project.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={submit} className="space-y-3.5">
              <div>
                <Label htmlFor="key-name" className="text-[12px]">
                  Key name
                </Label>
                <Input
                  id="key-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Production server"
                  autoFocus
                  className="mt-1.5 h-9 text-[13px]"
                />
                {error && <p className="mt-1.5 text-[11.5px] text-destructive">{error}</p>}
              </div>

              <DialogFooter className="gap-2 pt-1">
                <Button type="button" variant="outline" className="h-8 text-[12.5px]" onClick={close} disabled={mutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" className="h-8 gap-1.5 text-[12.5px]" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create key
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}