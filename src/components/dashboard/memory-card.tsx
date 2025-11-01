
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
import { format, parseISO } from 'date-fns';


const chartConfig = {
  value: {
    label: "Memory Usage",
    color: "hsl(var(--chart-2))",
    icon: MemoryStick
  },
} satisfies ChartConfig;

interface OracleMemoryCardProps {
  data: TimeSeriesData[];
}

const timeFormatter = (tick: string) => {
    if (!tick) return "";
    const date = parseISO(tick);
    return format(date, "HH:mm");
};

export default function OracleMemoryCard({ data = [] }: OracleMemoryCardProps) {
  return (
    <GlassCard className="lg:col-span-2">
      <CardHeader>
          <CardTitle>Oracle Memory Usage (Last 24 Hours)</CardTitle>
          <CardDescription>Total allocated SGA and PGA in gigabytes.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{
              left: -20,
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
             <YAxis unit="GB" />
            <ChartTooltip cursor={false} content={<ChartTooltipContent unit="GB" labelFormatter={(label, payload) => {
              if (payload?.[0]?.payload.date) {
                return `${format(parseISO(payload[0].payload.date), 'MMM d, h:mm a')}`
              }
              return label;
            }} />} />
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

    