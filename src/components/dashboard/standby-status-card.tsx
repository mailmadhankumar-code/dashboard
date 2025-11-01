
import React from "react";
import { GlassCard, CardHeader, CardTitle, CardContent, CardDescription } from "./glass-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StandbyStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StandbyStatusCardProps {
  standbyStatus: StandbyStatus[];
}

const statusVariant: { [key: string]: "default" | "destructive" | "secondary" | "outline" } = {
    SYNCHRONIZED: "default",
    APPLYING: "secondary",
    LAGGING: "destructive",
    APPLYING_LOG: "secondary",
};

export default function StandbyStatusCard({ standbyStatus }: StandbyStatusCardProps) {
  return (
    <GlassCard>
      <CardHeader>
        <CardTitle>Standby Status</CardTitle>
        <CardDescription>Synchronization status and lag times.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>MRP Status</TableHead>
                <TableHead>Sequence</TableHead>
                <TableHead>Transport Lag (hr)</TableHead>
                <TableHead>Apply Lag (hr)</TableHead>
                <TableHead>Apply Rate (MB/s)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standbyStatus.map((standby, index) => (
                <TableRow key={index}>
                  <TableCell>{standby.name}</TableCell>
                  <TableCell>
                     <Badge variant={statusVariant[standby.status] || 'outline'} className={cn("capitalize text-xs", { "bg-green-600": standby.status === "SYNCHRONIZED" })}>
                      {standby.status.toLowerCase().replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                     <Badge variant={statusVariant[standby.mrp_status] || 'outline'} className="capitalize text-xs">
                      {standby.mrp_status.toLowerCase().replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{standby.sequence}</TableCell>
                  <TableCell className="font-mono">{standby.transport_lag}</TableCell>
                  <TableCell className="font-mono">{standby.apply_lag}</TableCell>
                  <TableCell className="font-mono">{standby.apply_rate_mb_s.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </GlassCard>
  );
}
