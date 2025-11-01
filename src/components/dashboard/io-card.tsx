
"use client";

import React from "react";
import { GlassCard, CardHeader, CardTitle, CardContent, CardDescription } from "./glass-card";
import {
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { TimeSeriesData, DiskUsage, IoDetail } from "@/lib/types";
import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const chartConfig = {
  read: {
    label: "Read",
    color: "hsl(var(--chart-3))",
  },
  write: {
    label: "Write",
    color: "hsl(var(--chart-4))",
  },
};

interface IoCardProps {
  readData?: TimeSeriesData[];
  writeData?: TimeSeriesData[];
  diskUsage?: DiskUsage[];
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

const CustomTooltip = ({ active, payload, label, diskUsage }: any) => {
  if (active && payload && payload.length && label) {
    const date = parseISO(label);
    const readPayload = payload.find((p: any) => p.dataKey === 'read');
    const writePayload = payload.find((p: any) => p.dataKey === 'write');

    // Correctly access the details from the payload.
    const allDetails: IoDetail[] | undefined = readPayload?.payload?.details;

    return (
      <div className="p-2 text-xs bg-background/90 border border-border rounded-lg shadow-lg backdrop-blur-sm min-w-[350px]">
        <p className="font-bold mb-2">{formatInTimeZone(date, Intl.DateTimeFormat().resolvedOptions().timeZone, 'MMM d, h:mm a')}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <p className="font-semibold" style={{ color: chartConfig.read.color }}>
                Total Read: {(readPayload?.value || 0).toFixed(2)} MB/s
            </p>
            <p className="font-semibold" style={{ color: chartConfig.write.color }}>
                Total Write: {(writePayload?.value || 0).toFixed(2)} MB/s
            </p>
        </div>
        
        {allDetails && allDetails.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="font-bold mb-1">Disk Details:</p>
            <div className="grid grid-cols-[1fr,1fr,auto,auto,auto] gap-x-3 gap-y-1 items-center font-mono">
                <div className="font-semibold text-muted-foreground truncate">Disk Name</div>
                <div className="font-semibold text-muted-foreground truncate">Mount Point</div>
                <div className="font-semibold text-right" style={{color: chartConfig.read.color}}>R MB/s</div>
                <div className="font-semibold text-right" style={{color: chartConfig.write.color}}>W MB/s</div>
                <div className="font-semibold text-right">Usage</div>
                
              {allDetails.map((stats) => {
                const usage = diskUsage?.find((d: DiskUsage) => d.mount_point === stats.mount_point);
                return (
                    <React.Fragment key={stats.device}>
                      <div className="text-muted-foreground truncate" title={stats.device}>{stats.device}</div>
                      <div className="text-muted-foreground truncate" title={stats.mount_point}>{stats.mount_point}</div>
                      <div className="text-right tabular-nums">{stats.read_mb_s.toFixed(2)}</div>
                      <div className="text-right tabular-nums">{stats.write_mb_s.toFixed(2)}</div>
                      <div className="text-right tabular-nums">{usage ? `${usage.used_percent}%` : 'N/A'}</div>
                    </React.Fragment>
                )
              })}
            </div>
          </div>
        )}

      </div>
    );
  }

  return null;
};


function IoCard({ readData = [], writeData = [], diskUsage = [] }: IoCardProps) {

  const combinedData = readData.map((readPoint, index) => ({
    date: readPoint.date,
    read: readPoint.value,
    write: writeData[index]?.value || 0,
    details: readPoint.details || [], 
  }));

  return (
    <GlassCard className="lg:col-span-2">
      <CardHeader>
          <CardTitle>Host I/O Utilization</CardTitle>
          <CardDescription>I/O in MB/s from the OS and disk space utilization.</CardDescription>
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
             <ChartTooltip content={<CustomTooltip diskUsage={diskUsage} />} />
            <Area
              dataKey="read"
              name="Read"
              type="natural"
              fill="var(--color-read)"
              fillOpacity={0.4}
              stroke="var(--color-read)"
              stackId="a"
            />
             <Area
              dataKey="write"
              name="Write"
              type="natural"
              fill="var(--color-write)"
              fillOpacity={0.4}
              stroke="var(--color-write)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </GlassCard>
  );
}

export default React.memo(IoCard);
