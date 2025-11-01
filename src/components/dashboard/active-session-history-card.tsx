
"use client";

import React from "react";
import { GlassCard, CardHeader, CardTitle, CardContent, CardDescription } from "./glass-card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { TimeSeriesData } from "@/lib/types";
import { Users } from "lucide-react";
import { formatInTimeZone } from 'date-fns-tz';
import { parseISO } from 'date-fns';


const chartConfig = {
  value: {
    label: "Active Sessions",
    color: "hsl(var(--accent))",
    icon: Users
  },
} satisfies ChartConfig;

interface ActiveSessionHistoryCardProps {
  sessionHistory: TimeSeriesData[];
}

const timeFormatter = (tick: string) => {
    if (!tick) return "";
    try {
        const date = parseISO(tick);
        // Format time in local timezone
        return formatInTimeZone(date, Intl.DateTimeFormat().resolvedOptions().timeZone, 'HH:mm');
    } catch (e) {
        return "";
    }
};

const tooltipLabelFormatter = (label: string, payload?: any[]) => {
  if (payload?.[0]?.payload.date) {
    try {
        const date = parseISO(payload[0].payload.date);
        return formatInTimeZone(date, Intl.DateTimeFormat().resolvedOptions().timeZone, 'MMM d, h:mm a');
    } catch(e) {
        // fallback
        return label;
    }
  }
  return label;
};


function ActiveSessionHistoryCard({ sessionHistory = [] }: ActiveSessionHistoryCardProps) {
    
  // If we don't have enough data for a meaningful chart, show a loading/empty state.
  if (!sessionHistory || sessionHistory.length < 2) {
    const currentSessions = sessionHistory[0]?.value || 0;
    return (
        <GlassCard>
            <CardHeader>
                <CardTitle>Active User Sessions</CardTitle>
                <CardDescription>A real-time snapshot of active user sessions.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-48">
                 <div className="text-center">
                    <div className="text-6xl font-bold text-accent">{currentSessions}</div>
                    <div className="text-lg text-muted-foreground">Current Active Sessions</div>
                    {sessionHistory.length < 2 && <p className="text-xs text-muted-foreground mt-2">Waiting for more data to build 24-hour chart...</p>}
                </div>
            </CardContent>
        </GlassCard>
    )
  }
    
  return (
    <GlassCard>
      <CardHeader>
          <CardTitle>Active Sessions (Last 24 Hours)</CardTitle>
          <CardDescription>Count of active user sessions, recorded periodically.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart
            accessibilityLayer
            data={sessionHistory}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={timeFormatter}
              type="category"
              interval="preserveStartEnd"
            />
             <YAxis allowDecimals={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={tooltipLabelFormatter} />} />
            <Area
              dataKey="value"
              type="monotone"
              fill="var(--color-value)"
              fillOpacity={0.4}
              stroke="var(--color-value)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </GlassCard>
  );
}

export default React.memo(ActiveSessionHistoryCard);
