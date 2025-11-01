
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
import { MemoryStick } from "lucide-react";
import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';


const chartConfig = {
  value: {
    label: "Memory Usage",
    color: "hsl(var(--chart-2))",
    icon: MemoryStick
  },
} satisfies ChartConfig;

interface HostMemoryCardProps {
  data: TimeSeriesData[];
}

const timeFormatter = (tick: string) => {
    if (!tick) return "";
    try {
        const date = parseISO(tick);
        return formatInTimeZone(date, Intl.DateTimeFormat().resolvedOptions().timeZone, 'HH:mm');
    } catch(e) {
        return ""
    }
};

const tooltipLabelFormatter = (label: string, payload?: any[]) => {
  if (payload?.[0]?.payload.date) {
    try {
        const date = parseISO(payload[0].payload.date);
        return formatInTimeZone(date, Intl.DateTimeFormat().resolvedOptions().timeZone, 'MMM d, h:mm a');
    } catch(e) {
        return label;
    }
  }
  return label;
};


function HostMemoryCard({ data = [] }: HostMemoryCardProps) {
  return (
    <GlassCard className="lg:col-span-2">
      <CardHeader>
          <CardTitle>Host Memory Usage (Last 24 Hours)</CardTitle>
          <CardDescription>Total OS memory utilization percentage.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart
            accessibilityLayer
            data={data}
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
            />
             <YAxis unit="%" />
            <ChartTooltip cursor={false} content={<ChartTooltipContent unit="%" labelFormatter={tooltipLabelFormatter} />} />
            <Area
              dataKey="value"
              type="natural"
              fill="var(--color-value)"
              fillOpacity={0.4}
              stroke="var(--color-value)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </GlassCard>
  );
}

export default React.memo(HostMemoryCard);
