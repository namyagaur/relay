import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/components/theme/ThemeProvider';

const PALETTE = {
  light: { delivered: '#2F6F55', failed: '#B0453F', grid: '#E7E5E9', axis: '#777580' },
  dark: { delivered: '#6FCDA3', failed: '#E8736B', grid: '#33313D', axis: '#A6A2B2' },
};

function ChartTooltip({ active = false, payload = [], label = undefined }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="pop-shadow rounded-lg border border-border bg-popover px-2.5 py-2">
      <p className="mb-1.5 text-[10.5px] font-medium text-muted-foreground">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-[11.5px]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: entry.stroke }} />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-mono tabular-nums text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DeliveryActivityChart({ data = [], height = 256 }) {
  const { resolvedTheme } = useTheme();
  const colors = PALETTE[resolvedTheme] ?? PALETTE.light;
  const deliveredGradient = useId().replace(/:/g, '');
  const failedGradient = useId().replace(/:/g, '');

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id={`delivered-${deliveredGradient}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.delivered} stopOpacity={0.14} />
              <stop offset="100%" stopColor={colors.delivered} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`failed-${failedGradient}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.failed} stopOpacity={0.12} />
              <stop offset="100%" stopColor={colors.failed} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.grid} strokeDasharray="2 6" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.axis, fontSize: 10, fontFamily: 'Geist, system-ui, sans-serif' }}
            minTickGap={26}
            dy={10}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.axis, fontSize: 10, fontFamily: 'Geist, system-ui, sans-serif' }}
            width={42}
            allowDecimals={false}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: colors.axis, strokeOpacity: 0.35, strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="delivered"
            name="Delivered"
            stroke={colors.delivered}
            strokeWidth={1.6}
            fill={`url(#delivered-${deliveredGradient})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            animationDuration={480}
            animationEasing="ease-out"
          />
          <Area
            type="monotone"
            dataKey="failed"
            name="Failed"
            stroke={colors.failed}
            strokeWidth={1.6}
            fill={`url(#failed-${failedGradient})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            animationDuration={480}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend() {
  return (
    <div className="flex items-center gap-3 text-[10.5px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-[5px] w-[5px] rounded-full bg-success" />
        Delivered
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-[5px] w-[5px] rounded-full bg-danger" />
        Failed
      </span>
    </div>
  );
}