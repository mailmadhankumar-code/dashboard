
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
import { ProcessInfo } from "@/lib/process-info";
import { ColumnDef } from "@tanstack/react-table";
import { FixedSizeList as List } from 'react-window';

const columns: ColumnDef<ProcessInfo>[] = [
    { accessorKey: "pid", header: "PID" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "cpu_usage", header: "CPU %" },
    { accessorKey: "memory_mb", header: "Memory (MB)" },
    { accessorKey: "read_mb", header: "Read (MB)" },
    { accessorKey: "write_mb", header: "Write (MB)" },
    { accessorKey: "username", header: "Username" },
];

interface TopProcessesCardProps {
  topCpuProcesses: ProcessInfo[] | undefined;
  topMemoryProcesses: ProcessInfo[] | undefined;
  topIoProcesses: ProcessInfo[] | undefined;
  topNetworkProcesses: ProcessInfo[] | undefined;
}

const ProcessRow = ({ index, style, data }: { index: number; style: React.CSSProperties; data: ProcessInfo[] }) => {
  const process = data[index];
  return (
    <div style={style} className="flex items-center justify-between">
      <span>{process.pid}</span>
      <span>{process.name}</span>
      <span>{process.cpu_usage}</span>
      <span>{process.memory_mb}</span>
      <span>{process.read_mb}</span>
      <span>{process.write_mb}</span>
      <span>{process.username}</span>
    </div>
  );
};

export const TopProcessesCard: React.FC<TopProcessesCardProps> = ({
  topCpuProcesses,
  topMemoryProcesses,
  topIoProcesses,
  topNetworkProcesses,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Processes</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="cpu">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="cpu">Top CPU</TabsTrigger>
            <TabsTrigger value="memory">Top Memory</TabsTrigger>
            <TabsTrigger value="io">Top I/O</TabsTrigger>
            <TabsTrigger value="network">Top Network</TabsTrigger>
          </TabsList>
          <TabsContent value="cpu">
            {topCpuProcesses ? (
              <List
                height={400}
                itemCount={topCpuProcesses.length}
                itemSize={35}
                width="100%"
                itemData={topCpuProcesses}
              >
                {ProcessRow}
              </List>
            ) : (
              <p>No CPU process data available.</p>
            )}
          </TabsContent>
          <TabsContent value="memory">
            {topMemoryProcesses ? (
              <List
                height={400}
                itemCount={topMemoryProcesses.length}
                itemSize={35}
                width="100%"
                itemData={topMemoryProcesses}
              >
                {ProcessRow}
              </List>
            ) : (
              <p>No memory process data available.</p>
            )}
          </TabsContent>
          <TabsContent value="io">
            {topIoProcesses ? (
              <List
                height={400}
                itemCount={topIoProcesses.length}
                itemSize={35}
                width="100%"
                itemData={topIoProcesses}
              >
                {ProcessRow}
              </List>
            ) : (
              <p>No I/O process data available.</p>
            )}
          </TabsContent>
          <TabsContent value="network">
            {topNetworkProcesses ? (
              <List
                height={400}
                itemCount={topNetworkProcesses.length}
                itemSize={35}
                width="100%"
                itemData={topNetworkProcesses}
              >
                {ProcessRow}
              </List>
            ) : (
              <p>No network process data available.</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
