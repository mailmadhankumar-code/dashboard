
"use client";

import React, { useState } from "react";
import { GlassCard, CardHeader, CardTitle, CardContent, CardDescription } from "./glass-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OsInfo, ProcessInfo } from "@/lib/types";
import { Info, Cpu, MemoryStick, ArrowUp, ArrowDown } from "lucide-react";

interface OsOverviewCardProps {
  osInfo?: OsInfo;
}

const ProcessTable = ({ processes, title }: { processes: ProcessInfo[], title: string }) => (
    <div>
        <h3 className="text-lg font-semibold my-2">{title}</h3>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>PID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>CPU %</TableHead>
                    <TableHead>Mem %</TableHead>
                    <TableHead>Command</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {processes.map((p, i) => (
                    <TableRow key={`${p.pid}-${i}`}>
                        <TableCell>{p.pid}</TableCell>
                        <TableCell>{p.user}</TableCell>
                        <TableCell>{p.cpu_percent.toFixed(2)}</TableCell>
                        <TableCell>{p.memory_percent.toFixed(2)}</TableCell>
                        <TableCell className="max-w-xs truncate">{p.command}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);


function OsOverviewCard({ osInfo }: OsOverviewCardProps) {
  if (!osInfo) {
    return (
        <GlassCard>
            <CardHeader>
                <CardTitle>OS Overview</CardTitle>
            </CardHeader>
            <CardContent>
                <p>OS information is not available.</p>
            </CardContent>
        </GlassCard>
    );
  }

  return (
    <GlassCard>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>OS Overview</CardTitle>
            <CardDescription>{osInfo.platform} {osInfo.release}</CardDescription>
        </div>
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">Details</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Operating System Process Details</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <ProcessTable processes={osInfo.topCpuProcesses} title="Top CPU Processes"/>
                    <ProcessTable processes={osInfo.topMemoryProcesses} title="Top Memory Processes"/>
                </div>
            </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
         <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-muted-foreground" />
                <div>
                    <div className="text-muted-foreground">Uptime</div>
                    <div>{osInfo.uptime}</div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-muted-foreground" />
                <div>
                    <div className="text-muted-foreground">Total CPUs</div>
                    <div>{osInfo.totalCpu}</div>
                </div>
            </div>
             <div className="flex items-center gap-2">
                <MemoryStick className="h-5 w-5 text-muted-foreground" />
                <div>
                    <div className="text-muted-foreground">Total Memory</div>
                    <div>{osInfo.totalMemory.toFixed(2)} GB</div>
                </div>
            </div>
        </div>
      </CardContent>
    </GlassCard>
  );
}

export default React.memo(OsOverviewCard);
