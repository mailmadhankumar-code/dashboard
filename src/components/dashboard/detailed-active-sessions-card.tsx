
import React from "react";
import { GlassCard, CardHeader, CardTitle, CardContent, CardDescription } from "./glass-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DetailedActiveSession } from "@/lib/types";

interface DetailedActiveSessionsCardProps {
  sessions: DetailedActiveSession[];
}

export default function DetailedActiveSessionsCard({ sessions = [] }: DetailedActiveSessionsCardProps) {
  return (
    <GlassCard>
      <CardHeader>
        <CardTitle>Detailed Active Sessions</CardTitle>
        <CardDescription>All non-idle sessions from gv$session.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72 w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>INST</TableHead>
                <TableHead>SID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>SQL_ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>ET</TableHead>
                <TableHead>Object#</TableHead>
                <TableHead>BS</TableHead>
                <TableHead>BI</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Machine</TableHead>
                <TableHead>Terminal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session, index) => (
                <TableRow key={`${session.inst}-${session.sid}-${index}`}>
                  <TableCell>{session.inst}</TableCell>
                  <TableCell>{session.sid}</TableCell>
                  <TableCell>{session.username}</TableCell>
                  <TableCell>{session.sql_id}</TableCell>
                  <TableCell>{session.status}</TableCell>
                  <TableCell className="truncate max-w-[150px]">{session.event}</TableCell>
                  <TableCell>{session.et}</TableCell>
                  <TableCell>{session.obj}</TableCell>
                  <TableCell>{session.bs}</TableCell>
                  <TableCell>{session.bi}</TableCell>
                  <TableCell className="truncate max-w-[150px]">{session.module}</TableCell>
                  <TableCell className="truncate max-w-[150px]">{session.machine}</TableCell>
                  <TableCell>{session.terminal}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </GlassCard>
  );
}
