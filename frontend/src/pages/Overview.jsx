import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, Radio, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RANGES } from '@/constants/domain';
import { getDashboard } from '@/services/api/dashboard';
import PageHeader from '@/components/shared/PageHeader';
import Panel from '@/components/shared/Panel';
import MetricCard from '@/components/dashboard/MetricCard';
import DeliveryHealth from '@/components/dashboard/DeliveryHealth';
import RecentEventsTable from '@/components/dashboard/RecentEventsTable';
import EndpointHealthList from '@/components/dashboard/EndpointHealthList';
import DeliveryActivityChart, { ChartLegend } from '@/components/charts/DeliveryActivityChart';
import ErrorState from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export default function Overview() {
  const [range, setRange] = useState('7d');
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', range],
    queryFn: () => getDashboard(range),
  });

  const kpis = data?.kpis;

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Monitor your event delivery infrastructure."
        actions={
          <>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="h-[30px] w-[152px] rounded-[7px] text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {RANGES.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-[12.5px]">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-[30px] gap-1.5 rounded-[7px] px-2.5 text-[12px]"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} strokeWidth={1.75} />
              Refresh
            </Button>
          </>
        }
      />

      {isError ? (
        <ErrorState
          title="Unable to load dashboard"
          message={error?.message}
          onRetry={refetch}
        />
      ) : (
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <MetricCard
              label="Total events"
              value={kpis?.totalEvents ?? 0}
              icon={Radio}
              loading={isLoading}
              trend={kpis?.eventsDelta != null ? { value: kpis.eventsDelta } : null}
              hint="Across this project"
            />
            <MetricCard
              label="Delivered events"
              value={kpis?.delivered ?? 0}
              icon={CheckCircle2}
              loading={isLoading}
              hint="Across this project"
            />
            <MetricCard
              label="Failed events"
              value={kpis?.failed ?? 0}
              icon={AlertTriangle}
              loading={isLoading}
              hint="Across this project"
            />
            <MetricCard
              label="Pending events"
              value={kpis?.pending ?? 0}
              icon={Clock}
              loading={isLoading}
              hint="Pending or processing"
            />
          </div>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
            <Panel
              className="lg:col-span-2"
              title="Delivery activity"
              description="Recent sample of up to 50 delivery attempts"
              action={<ChartLegend />}
              bodyClassName="pb-2"
            >
              {isLoading ? (
                <Skeleton className="h-[256px] w-full" />
              ) : (
                <DeliveryActivityChart data={data.series} />
              )}
            </Panel>

            <Panel title="Delivery health" description="Outcome breakdown for this period">
              <DeliveryHealth health={data?.health} loading={isLoading} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <Panel
              title="Recent events"
              description="Latest events received by Relay"
              action={
                <Link to="/events" className="text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                  View all
                </Link>
              }
              bodyClassName="pb-1"
            >
              <RecentEventsTable events={data?.recentEvents} loading={isLoading} />
            </Panel>

            <Panel
              title="Endpoint health"
              description="Recent sample of up to 50 attempts by destination"
              action={
                <Link to="/endpoints" className="text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                  View all
                </Link>
              }
            >
              <EndpointHealthList endpoints={data?.endpointHealth} loading={isLoading} />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}