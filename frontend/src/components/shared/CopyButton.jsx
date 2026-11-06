import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** @typedef {import('class-variance-authority').VariantProps<typeof import('@/components/ui/button').buttonVariants>} ButtonVariants */

/**
 * @param {{value: any, label?: string, className?: string, variant?: ButtonVariants['variant'], size?: ButtonVariants['size']}} props
 */
export default function CopyButton({
  value,
  label = undefined,
  className = undefined,
  variant = 'ghost',
  size = 'sm',
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={copy}
      aria-label={label ? undefined : 'Copy to clipboard'}
      className={cn('h-7 gap-1.5 px-2 text-[11.5px] text-muted-foreground hover:text-foreground', className)}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" strokeWidth={2} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
      {label && <span>{copied ? 'Copied' : label}</span>}
    </Button>
  );
}