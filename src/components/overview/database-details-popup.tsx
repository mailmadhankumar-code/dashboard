
"use client";

import React from "react";
import { DashboardData } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cpu, MemoryStick, Server, HardDrive, Network } from "lucide-react";
import { ProcessInfo } from "@/lib/process-info";

interface DatabaseDetailsPopupProps {
  dbName: string;
  customerName: string;
  data: DashboardData;
  onClose: () => void;
}

const ProcessTable = ({ title, icon, processes, unitLabel = 'Usage' }: { title: string, icon: React.ReactNode, processes: ProcessInfo[] | undefined, unitLabel?: string }) => (
    <div>
        <h3 className="font-bold mb-2 flex items-center">{icon}{title}</h3>
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Process Name</TableHead>
                        <TableHead className="text-right">{unitLabel}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {processes && processes.length > 0 ? (
                        processes.map((p, index) => (
                            <TableRow key={index}>
                                <TableCell>{p.name}</TableCell>
                                <TableCell className="text-right">{p.usage.toFixed(1)} {p.unit}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={2} className="text-center">No data available</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    </div>
);

export function DatabaseDetailsPopup({ dbName, customerName, data, onClose }: DatabaseDetailsPopupProps) {
  const { osInfo, dbStatus, dbName: databaseName } = data;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-auto md:max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Details for {dbName} ({customerName})</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="info" className="flex-grow flex flex-col overflow-hidden">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">DB & Server Info</TabsTrigger>
            <TabsTrigger value="processes" className="flex-1">Top Processes</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="flex-grow overflow-auto p-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold mb-2 flex items-center"><Server className="w-5 h-5 mr-2"/>Server Info</h3>
                  <p><strong>Platform:</strong> {osInfo?.platform}</p>
                  <p><strong>Release:</strong> {osInfo?.release}</p>
                  <p><strong>Uptime:</strong> {osInfo?.uptime}</p>
                  <p><strong>Total CPU Cores:</strong> {osInfo?.totalCpu}</p>
                  <p><strong>Total Memory:</strong> {osInfo?.totalMemory} GB</p>
                </div>
                 <div>
                  <h3 className="font-bold mb-2 flex items-center"><Server className="w-5 h-5 mr-2"/>Database Info</h3>
                  <p><strong>DB Name:</strong> {databaseName}</p>
                  <p><strong>DB Status:</strong> {dbStatus}</p>
                </div>
            </div>
          </TabsContent>
          <TabsContent value="processes" className="flex-grow overflow-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProcessTable title="Top CPU Processes" icon={<Cpu className="w-5 h-5 mr-2"/>} processes={osInfo?.topCpuProcesses} unitLabel="CPU %" />
              <ProcessTable title="Top Memory Processes" icon={<MemoryStick className="w-5 h-5 mr-2"/>} processes={osInfo?.topMemoryProcesses} unitLabel="MEM %"/>
              <ProcessTable title="Top I/O Processes" icon={<HardDrive className="w-5 h-5 mr-2"/>} processes={osInfo?.topIoProcesses} unitLabel="MB/s" />
              <ProcessTable title="Top Network Processes" icon={<Network className="w-5 h-5 mr-2"/>} processes={osInfo?.topNetworkProcesses} unitLabel="MB/s" />
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter className="mt-4">
            <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
