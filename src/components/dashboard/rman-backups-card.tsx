
import React from "react";
import { GlassCard, CardHeader, CardTitle, CardContent, CardDescription } from "./glass-card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RmanBackup } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RmanBackupsCardProps {
  backups: RmanBackup[];
}

const statusVariant: { [key: string]: "default" | "destructive" | "secondary" } = {
    COMPLETED: "default",
    "COMPLETED WITH WARNINGS": "default",
    FAILED: "destructive",
    RUNNING: "secondary",
};

const formatBytes = (bytes: number | null | undefined): string => {
    if (bytes === null || bytes === undefined || isNaN(bytes) || bytes <= 0) {
        return "0 B";
    }
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    if (i < 0 || i >= sizes.length) { // Handle edge cases for very small numbers
        return "0 B";
    }
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const formatDuration = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) {
        return "N/A";
    }
    if (seconds === 0) {
        return "0s";
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    return [
        h > 0 ? `${h}h` : null,
        m > 0 ? `${m}m` : null,
        s > 0 ? `${s}s` : null,
    ]
    .filter(Boolean)
    .join(" ") || "0s";
};


export default function RmanBackupsCard({ backups = [] }: RmanBackupsCardProps) {
  return (
    <GlassCard>
      <CardHeader>
        <CardTitle>RMAN Backups</CardTitle>
        <CardDescription>Last 7 days status.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell className="text-xs">{backup.start_time}</TableCell>
                   <TableCell className="text-xs">{backup.end_time || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[backup.status] || 'secondary'} className={cn("capitalize text-xs", { "bg-green-600": backup.status === "COMPLETED" })}>
                      {backup.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono">{formatBytes(backup.input_bytes)}</TableCell>
                  <TableCell className="text-right text-xs font-mono">{formatDuration(backup.elapsed_seconds)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </GlassCard>
  );
}

    