
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
import { Network } from "lucide-react";
import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';


const chartConfig = {
  up: {
    label: "Upload",
    color: "hsl(var(--chart-4))",
  },
  down: {
    label: "Download",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig;

interface NetworkCardProps {
  upData: TimeSeriesData[];
  downData: TimeSeriesData[];
}

const timeFormatter = (tick: string) => {
    if (!tick) return "";
    try {
        const date = parseISO(tick);
        return formatInTimeZone(date, Intl.DateTimeFormat().resolvedOptions().timeZone, 'HH:mm');
    } catch(e) {
        return "";
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

function NetworkCard({ upData = [], downData = [] }: NetworkCardProps) {
  
  const combinedData = upData.map((upPoint, index) => ({
    date: upPoint.date,
    up: upPoint.value,
    down: downData[index]?.value || 0,
  }));

  return (
    <GlassCard className="lg:col-span-2">
      <CardHeader>
          <CardTitle>Network Usage (Last 24 Hours)</CardTitle>
          <CardDescription>Upload and Download in MB/s.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart
            accessibilityLayer
            data={combinedData}
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
             <YAxis unit="MB/s" />
            <ChartTooltip cursor={false} content={<ChartTooltipContent unit="MB/s" labelFormatter={tooltipLabelFormatter} />} />
            <Area
              dataKey="up"
              type="natural"
              fill="var(--color-up)"
              fillOpacity={0.4}
              stroke="var(--color-up)"
              stackId="a"
            />
            <Area
              dataKey="down"
              type="natural"
              fill="var(--color-down)"
              fillOpacity={0.4}
              stroke="var(--color-down)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </GlassCard>
  );
}

export default React.memo(NetworkCard);
