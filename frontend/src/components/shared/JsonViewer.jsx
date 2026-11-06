import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const isObject = (value) => value !== null && typeof value === 'object';

function Token({ value }) {
  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (typeof value === 'string') return <span className="text-success break-all">"{value}"</span>;
  if (typeof value === 'number') return <span className="text-brand tabular-nums">{value}</span>;
  if (typeof value === 'boolean') return <span className="text-warning">{String(value)}</span>;
  return <span className="text-foreground">{String(value)}</span>;
}

function JsonNode({ label, value, depth, defaultDepth }) {
  const [open, setOpen] = useState(depth < defaultDepth);

  if (!isObject(value)) {
    return (
      <div className="flex gap-1.5 py-[1px]" style={{ paddingLeft: depth * 13 }}>
        {label !== null && <span className="shrink-0 text-muted-foreground">{label}:</span>}
        <Token value={value} />
      </div>
    );
  }

  const entries = Object.entries(value);
  const isArray = Array.isArray(value);
  const brackets = isArray ? ['[', ']'] : ['{', '}'];

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1 rounded py-[1px] pr-1 text-left transition-colors hover:bg-accent"
        style={{ paddingLeft: depth * 13 }}
      >
        <ChevronRight
          className={cn('h-3 w-3 shrink-0 text-muted-foreground/70 transition-transform', open && 'rotate-90')}
          strokeWidth={2}
        />
        {label !== null && <span className="shrink-0 text-muted-foreground">{label}:</span>}
        <span className="text-muted-foreground">{brackets[0]}</span>
        {!open && <span className="text-[11px] text-muted-foreground/70">{entries.length}</span>}
        {!open && <span className="text-muted-foreground">{brackets[1]}</span>}
      </button>

      {open && (
        <>
          {entries.map(([key, child]) => (
            <JsonNode
              key={key}
              label={isArray ? null : key}
              value={child}
              depth={depth + 1}
              defaultDepth={defaultDepth}
            />
          ))}
          <div className="text-muted-foreground" style={{ paddingLeft: depth * 13 + 16 }}>
            {brackets[1]}
          </div>
        </>
      )}
    </div>
  );
}

export default function JsonViewer({ data, className = undefined, maxHeight = undefined, defaultDepth = 2 }) {
  return (
    <div
      className={cn('overflow-auto scrollbar-thin font-mono text-[11.5px] leading-[1.65] text-foreground', className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <JsonNode label={null} value={data} depth={0} defaultDepth={defaultDepth} />
    </div>
  );
}