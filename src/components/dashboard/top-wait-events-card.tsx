
"use client";

import React from "react";
import { GlassCard, CardHeader, CardTitle, CardContent, CardDescription } from "./glass-card";
import type { WaitEvent } from "@/lib/types";
import PlaceholderCard from "./placeholder-card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { parseISO } from "date-fns";
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from "@/lib/utils";

interface TopWaitEventsCardProps {
  waitEvents: WaitEvent[];
}

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
  "hsl(var(--accent))",
];

const timeFormatter = (tick: string) => {
  if (!tick) return "";
  try {
    const date = parseISO(tick);
    // Always format time in the user's local timezone
    return formatInTimeZone(date, Intl.DateTimeFormat().resolvedOptions().timeZone, 'HH:mm');
  } catch(e) {
    console.error("Error formatting time tick:", e);
    return "";
  }
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length && label) {
      const date = parseISO(label);
      const hasLatencyData = payload.some((p: any) => p.payload.latency[p.dataKey] !== null && p.payload.latency[p.dataKey] !== undefined);

      return (
        <div className="p-2 text-xs bg-background/90 border border-border rounded-lg shadow-lg backdrop-blur-sm min-w-[250px]">
          <p className="font-bold mb-2">{formatInTimeZone(date, Intl.DateTimeFormat().resolvedOptions().timeZone, 'MMM d, h:mm a')}</p>
          <div className={cn("grid gap-x-3 gap-y-1 items-center", hasLatencyData ? "grid-cols-[auto,1fr,1fr]" : "grid-cols-[auto,1fr]")}>
             <div className="font-semibold">Event</div>
             <div className="font-semibold text-right">Sessions</div>
             {hasLatencyData && <div className="font-semibold text-right">Latency(s)</div>}
            {payload.map((p: any, index: number) => (
              <React.Fragment key={index}>
                <div className="flex items-center gap-2">
                    <div style={{width: 10, height: 10, backgroundColor: p.color, borderRadius: '50%'}} />
                    <span className="truncate max-w-[120px]" title={p.name}>{p.name}</span>
                </div>
                <div className="text-right font-mono">{p.value}</div>
                {hasLatencyData && (
                    <div className="text-right font-mono">
                        {p.payload.latency[p.dataKey] !== null && p.payload.latency[p.dataKey] !== undefined 
                            ? p.payload.latency[p.dataKey].toFixed(4)
                            : 'N/A'
                        }
                    </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      );
    }
  
    return null;
  };

export default function TopWaitEventsCard({ waitEvents = [] }: TopWaitEventsCardProps) {
  // Check if we have historical data. The presence of the 'data' array with content indicates this.
  const hasHistoricalData = waitEvents.length > 0 && waitEvents.some(e => e.data && e.data.length > 0);
  const isSnapshotData = waitEvents.length > 0 && !hasHistoricalData;

  if (!waitEvents || waitEvents.length === 0) {
    return <PlaceholderCard title="Top Wait Events" description="No active wait events found. Data is being collected." />;
  }

  if (isSnapshotData) {
    // This is the fallback display for the first few polls on a Standard Edition DB
    return (
        <GlassCard>
          <CardHeader>
            <CardTitle>Top Wait Events (Real-time Snapshot)</CardTitle>
            <CardDescription>
              Number of active sessions waiting on each event. 24h history is being collected from snapshots.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
             {waitEvents.slice(0,10).map((event, index) => (
                 <div key={index} className="flex justify-between items-center text-sm">
                     <span className="truncate text-muted-foreground">{event.event}</span>
                     <span className="font-bold font-mono">{event.value} sessions</span>
                 </div>
             ))}
          </CardContent>
        </GlassCard>
      );
  }

  // --- Process data for historical chart ---
  // Determine if the data comes from ASH by checking for the presence of latency data
  const isFromASH = waitEvents.some(e => e.data?.some(d => d.latency !== null && d.latency !== undefined));
  
  const top5Events = waitEvents.slice(0, 5).map(e => e.event);
  
  const allTimestamps = [...new Set(waitEvents.flatMap(e => e.data?.map(d => d.date) || []))].sort();

  const chartData = allTimestamps.map(ts => {
      const dataPoint: { [key: string]: any } = { date: ts, latency: {} };
      top5Events.forEach(event => {
          const eventData = waitEvents.find(e => e.event === event);
          const point = eventData?.data?.find(d => d.date === ts);
          dataPoint[event] = point ? point.value : 0;
          dataPoint.latency[event] = point ? point.latency : null;
      });
      return dataPoint;
  });

  return (
    <GlassCard>
      <CardHeader>
        <CardTitle>Top Wait Events (24h)</CardTitle>
        <CardDescription>
            {`Number of active sessions by wait event. Data from ${isFromASH ? 'GV$ACTIVE_SESSION_HISTORY' : 'v$session snapshots'}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={256}>
            <AreaChart
                data={chartData}
                 margin={{
                    top: 10, right: 30, left: 0, bottom: 0,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={timeFormatter} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} label={{ value: "Active Sessions", angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconSize={10} wrapperStyle={{fontSize: "12px"}} />
                {top5Events.map((event, index) => (
                    <Area
                        key={event}
                        type="monotone"
                        dataKey={event}
                        stackId="1"
                        stroke={chartColors[index % chartColors.length]}
                        fill={chartColors[index % chartColors.length]}
                        fillOpacity={0.4}
                        name={event}
                    />
                ))}
            </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </GlassCard>
  );
}

    