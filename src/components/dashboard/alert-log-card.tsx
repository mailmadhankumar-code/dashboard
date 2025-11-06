import React from "react";
import { GlassCard, CardHeader, CardTitle, CardContent, CardDescription } from "./glass-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AlertLogEntry } from "@/lib/types";

interface AlertLogCardProps {
  alerts: AlertLogEntry[];
}

export default function AlertLogCard({ alerts }: AlertLogCardProps) {
  return (
    <GlassCard>
      <CardHeader>
        <CardTitle>Alert Log Errors</CardTitle>
        <CardDescription>ORA- errors from the last hour.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>{alert.timestamp}</TableCell>
                  <TableCell className="font-mono font-bold text-red-400">{alert.error_code}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </GlassCard>
  );
}
