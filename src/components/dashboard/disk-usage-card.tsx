
"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import type { DiskUsage } from "@/lib/types";
import { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

// Default threshold for disk usage warning
const DEFAULT_THRESHOLD = 90;

// Defines the columns for the DataTable, making the usage bar dynamic based on a threshold.
export const columns = (threshold: number): ColumnDef<DiskUsage>[] => [
    {
        accessorKey: "mount_point",
        header: "Mount Point",
    },
    {
        accessorKey: "total_gb",
        header: "Total (GB)",
        cell: ({ row }) => row.original.total_gb.toFixed(2),
    },
    {
        accessorKey: "used_gb",
        header: "Used (GB)",
        cell: ({ row }) => row.original.used_gb.toFixed(2),
    },
    {
        id: "free_gb",
        header: "Free (GB)",
        cell: ({ row }) => (row.original.total_gb - row.original.used_gb).toFixed(2),
    },
    {
        accessorKey: "used_percent",
        header: "Used %",
        cell: ({ row }) => {
            const usage = row.original.used_percent;
            const isAboveThreshold = usage > threshold;
            return (
                <div className="flex items-center gap-2 w-full">
                    <Progress
                        value={usage}
                        className={cn("w-[60%]", isAboveThreshold && "[&>div]:bg-destructive")}
                        aria-label={`${row.original.mount_point} usage`}
                    />
                    <span className={cn("font-medium", isAboveThreshold && "text-destructive")}>
                        {usage.toFixed(2)}%
                    </span>
                </div>
            );
        },
    },
];

interface DiskUsageCardProps {
  data: DiskUsage[] | undefined;
  threshold?: number;
}

/**
 * A card component that displays disk usage statistics in a clean, tabular format.
 * It highlights rows where usage exceeds a defined threshold.
 */
export default function DiskUsageCard({ data, threshold = DEFAULT_THRESHOLD }: DiskUsageCardProps) {
  const tableColumns = columns(threshold);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Disk Usage</CardTitle>
        <CardDescription>OS-level drive and mount point usage.</CardDescription>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <DataTable columns={tableColumns} data={data} />
        ) : (
          <p className="text-center py-8">No disk usage data available.</p>
        )}
      </CardContent>
    </Card>
  );
}
