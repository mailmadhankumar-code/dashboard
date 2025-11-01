
"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { ProcessInfo } from "@/lib/types";
import { ColumnDef } from "@tanstack/react-table";

// Defines the columns for the process data tables.
export const columns: ColumnDef<ProcessInfo>[] = [
    { accessorKey: "pid", header: "PID" },
    { accessorKey: "name", header: "Name" },
    { 
        accessorKey: "cpu_usage", 
        header: "CPU %",
        cell: ({ row }) => `${row.original.cpu_usage?.toFixed(2) ?? 0}`
    },
    {
        accessorKey: "memory_mb",
        header: "Memory (MB)",
        cell: ({ row }) => `${row.original.memory_mb?.toFixed(2) ?? 0}`
    },
    {
        accessorKey: "read_mb",
        header: "Read (MB)",
        cell: ({ row }) => `${row.original.read_mb?.toFixed(2) ?? 0}`
    },
    {
        accessorKey: "write_mb",
        header: "Write (MB)",
        cell: ({ row }) => `${row.original.write_mb?.toFixed(2) ?? 0}`
    },
    { accessorKey: "username", header: "Username" },
];

interface TopProcessesCardProps {
  topCpuProcesses: ProcessInfo[] | undefined;
  topMemoryProcesses: ProcessInfo[] | undefined;
  topIoProcesses: ProcessInfo[] | undefined;
}

/**
 * A card component that displays top processes categorized by CPU, Memory, and I/O usage.
 * It uses tabs to switch between the different categories and a reusable DataTable to display the data.
 */
export function TopProcessesCard({ topCpuProcesses, topMemoryProcesses, topIoProcesses }: TopProcessesCardProps) {
  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Top Processes</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="cpu">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cpu">Top CPU</TabsTrigger>
            <TabsTrigger value="memory">Top Memory</TabsTrigger>
            <TabsTrigger value="io">Top I/O</TabsTrigger>
          </TabsList>
          
          <TabsContent value="cpu">
            {topCpuProcesses && topCpuProcesses.length > 0 ? (
              <DataTable columns={columns} data={topCpuProcesses} />
            ) : (
              <p className="text-center py-8">No CPU process data available.</p>
            )}
          </TabsContent>
          
          <TabsContent value="memory">
            {topMemoryProcesses && topMemoryProcesses.length > 0 ? (
              <DataTable columns={columns} data={topMemoryProcesses} />
            ) : (
              <p className="text-center py-8">No memory process data available.</p>
            )}
          </TabsContent>
          
          <TabsContent value="io">
            {topIoProcesses && topIoProcesses.length > 0 ? (
              <DataTable columns={columns} data={topIoProcesses} />
            ) : (
              <p className="text-center py-8">No I/O process data available.</p>
            )}
          </TabsContent>

        </Tabs>
      </CardContent>
    </Card>
  );
};
