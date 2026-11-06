import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { createEndpoint } from '@/services/api/endpoints';
import CopyButton from '@/components/shared/CopyButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

export default function AddEndpointDialog({ open, onOpenChange }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [secret, setSecret] = useState(null);

  const mutation = useMutation({
    mutationFn: createEndpoint,
    onSuccess: (endpoint) => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSecret(endpoint.signingSecret ?? null);
      toast({ title: 'Endpoint added', description: endpoint.url.replace('https://', '') });
      if (!endpoint.signingSecret) setError('Endpoint was created, but the signing secret was not returned.');
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const resetAndClose = () => {
    setUrl('');
    setDescription('');
    setError('');
    setSecret(null);
    onOpenChange(false);
  };

  const submit = (event) => {
    event.preventDefault();
    let parsed;
    try {
      parsed = new URL(url.trim());
    } catch {
      setError('Enter a valid URL, including https://');
      return;
    }
    if (parsed.protocol !== 'https:') {
      setError('Endpoint URLs must use HTTPS.');
      return;
    }
    setError('');
    mutation.mutate({ url: url.trim(), description: description.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : resetAndClose())}>
      <DialogContent className="max-w-[460px] border-border bg-surface">
        {secret ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-[16px] font-semibold tracking-[-0.02em]">Endpoint created</DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground">
                Relay generated a signing secret for this endpoint. Store it now — it will not be shown again.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-border bg-elevated p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                  Signing secret
                </p>
                <CopyButton value={secret} label="Copy" />
              </div>
              <p className="mt-1.5 break-all font-mono text-[11.5px] text-foreground">{secret}</p>
            </div>

            <div className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[11.5px] leading-5 text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              Verify webhook signatures with this secret. Anyone with it can forge delivery requests.
            </div>

            <DialogFooter>
              <Button className="h-8 gap-1.5 text-[12.5px]" onClick={resetAndClose}>
                <Check className="h-3.5 w-3.5" strokeWidth={2} />
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-[16px] font-semibold tracking-[-0.02em]">Add endpoint</DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground">
                Relay sends a POST request with the event payload to this URL.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={submit} className="space-y-3.5">
              <div>
                <Label htmlFor="endpoint-url" className="text-[12px]">
                  Endpoint URL
                </Label>
                <Input
                  id="endpoint-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://api.example.com/webhooks/relay"
                  autoFocus
                  className="mt-1.5 h-9 font-mono text-[12.5px]"
                />
              </div>

              <div>
                <Label htmlFor="endpoint-description" className="text-[12px]">
                  Description <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="endpoint-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Payment lifecycle consumer"
                  rows={2}
                  className="mt-1.5 resize-none text-[13px]"
                />
              </div>

              {error && <p className="text-[11.5px] text-destructive">{error}</p>}

              <DialogFooter className="gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 text-[12.5px]"
                  onClick={resetAndClose}
                  disabled={mutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" className="h-8 gap-1.5 text-[12.5px]" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add endpoint
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}