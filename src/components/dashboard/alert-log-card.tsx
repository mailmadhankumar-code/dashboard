
import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AlertLogEntry } from "@/lib/types";

interface AlertLogCardProps {
  // The data prop can be undefined, so we need to handle that.
  data: AlertLogEntry[] | undefined;
}

export default function AlertLogCard({ data }: AlertLogCardProps) {
  // If data is undefined or null, default to an empty array to prevent crashes.
  const alerts = data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert Log</CardTitle>
        <CardDescription>Critical errors from the database alert log.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Error Code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  // Using alert.id as the key, which is a stable identifier.
                  <TableRow key={alert.id}>
                    <TableCell>{new Date(alert.timestamp).toLocaleString()}</TableCell>
                    <TableCell className="font-mono font-bold text-red-500">{alert.error_code}</TableCell>
                  </TableRow>
                ))
              ) : (
                // Display a user-friendly message when there are no alerts.
                <TableRow>
                  <TableCell colSpan={2} className="text-center">
                    No new alerts in the log.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
