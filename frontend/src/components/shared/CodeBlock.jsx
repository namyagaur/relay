import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import CopyButton from '@/components/shared/CopyButton';

const TOKEN_PATTERN =
  /("(?:[^"\\]|\\.)*")|(#.*$)|(\b(?:curl|npm|pnpm|yarn|node|const|let|await|async|function|return|if|else|new|import|from|export|POST|GET|PATCH|DELETE)\b)|(\b\d+(?:\.\d+)?\b)/gm;

function highlight(code) {
  const nodes = [];
  let lastIndex = 0;
  let match;
  TOKEN_PATTERN.lastIndex = 0;

  while ((match = TOKEN_PATTERN.exec(code)) !== null) {
    if (match.index > lastIndex) nodes.push(code.slice(lastIndex, match.index));
    const [raw, string, comment, keyword, number] = match;
    const className = string
      ? 'text-success'
      : comment
        ? 'text-muted-foreground/70 italic'
        : keyword
          ? 'text-brand'
          : number
            ? 'text-warning'
            : undefined;
    nodes.push(
      <span key={`${match.index}-${raw}`} className={className}>
        {raw}
      </span>,
    );
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < code.length) nodes.push(code.slice(lastIndex));
  return nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>);
}

export default function CodeBlock({ code, language = 'bash', filename, className = undefined }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-elevated', className)}>
      <div className="flex items-center justify-between border-b border-border px-3 py-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {filename ?? language}
        </span>
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto scrollbar-thin px-3.5 py-3 font-mono text-[11.5px] leading-[1.75] text-foreground">
        <code>{highlight(code)}</code>
      </pre>
    </div>
  );
}