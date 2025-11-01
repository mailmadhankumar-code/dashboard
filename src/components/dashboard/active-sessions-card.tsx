import React from "react";
import { GlassCard, CardHeader, CardTitle, CardContent, CardDescription } from "./glass-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ActiveSession } from "@/lib/types";

interface ActiveSessionsCardProps {
  sessions: ActiveSession[];
}

export default function ActiveSessionsCard({ sessions }: ActiveSessionsCardProps) {
  return (
    <GlassCard>
      <CardHeader>
        <CardTitle>Active Sessions</CardTitle>
        <CardDescription>Currently active database sessions.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Program</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session, index) => (
                <TableRow key={`${session.sid}-${index}`}>
                  <TableCell>{session.sid}</TableCell>
                  <TableCell>{session.username}</TableCell>
                  <TableCell className="truncate max-w-[120px]">{session.program}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </GlassCard>
  );
}
