import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import { createEvent } from '@/services/api/events';
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

export default function SendEventDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [eventType, setEventType] = useState('');
  const [payload, setPayload] = useState('{}');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setEventType('');
    setPayload('{}');
    setIdempotencyKey('');
    setError('');
  };

  const mutation = useMutation({
    mutationFn: createEvent,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({
        title: result.duplicate ? 'Existing event returned' : 'Event sent',
        description: result.duplicate ? 'This idempotency key has already been used.' : 'Your event is now queued for delivery.',
      });
      reset();
      onOpenChange(false);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const close = () => {
    if (mutation.isPending) return;
    reset();
    onOpenChange(false);
  };

  const submit = (event) => {
    event.preventDefault();
    const trimmedEventType = eventType.trim();
    if (!trimmedEventType) {
      setError('Enter an event type.');
      return;
    }

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      setError('Payload must be valid JSON.');
      return;
    }
    if (!parsedPayload || Array.isArray(parsedPayload) || typeof parsedPayload !== 'object') {
      setError('Payload must be a JSON object.');
      return;
    }

    const trimmedIdempotencyKey = idempotencyKey.trim();
    if (trimmedIdempotencyKey.length > 255) {
      setError('Idempotency key must be 255 characters or fewer.');
      return;
    }

    setError('');
    mutation.mutate({
      eventType: trimmedEventType,
      payload: parsedPayload,
      idempotencyKey: trimmedIdempotencyKey || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-[540px] border-border bg-surface">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-semibold tracking-[-0.02em]">Send event</DialogTitle>
          <DialogDescription className="text-[12.5px] text-muted-foreground">
            Publish an event to the currently authenticated project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <Label htmlFor="event-type" className="text-[12px]">Event type</Label>
            <Input
              id="event-type"
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
              placeholder="invoice.paid"
              autoFocus
              required
              maxLength={255}
              className="mt-1.5 h-9 font-mono text-[12.5px]"
            />
          </div>

          <div>
            <Label htmlFor="event-payload" className="text-[12px]">JSON payload</Label>
            <Textarea
              id="event-payload"
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              required
              rows={9}
              spellCheck={false}
              className="mt-1.5 resize-y font-mono text-[12px] leading-5"
              aria-describedby="event-payload-help"
            />
            <p id="event-payload-help" className="mt-1.5 text-[11px] text-muted-foreground">Enter a JSON object.</p>
          </div>

          <div>
            <Label htmlFor="idempotency-key" className="text-[12px]">
              Idempotency key <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="idempotency-key"
              value={idempotencyKey}
              onChange={(event) => setIdempotencyKey(event.target.value)}
              placeholder="invoice-2026-001"
              maxLength={255}
              className="mt-1.5 h-9 font-mono text-[12.5px]"
            />
          </div>

          {error && <p className="text-[11.5px] text-destructive" role="alert">{error}</p>}

          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" className="h-8 text-[12.5px]" onClick={close} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" className="h-8 gap-1.5 text-[12.5px]" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {mutation.isPending ? 'Sendingâ€¦' : 'Send event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
