
"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessInfo } from "@/lib/process-info";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<ProcessInfo>[] = [
    { accessorKey: "pid", header: "PID" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "cpu_usage", header: "CPU %" },
    { accessorKey: "memory_mb", header: "Memory (MB)" },
    { accessorKey: "read_mb", header: "Read (MB)" },
    { accessorKey: "write_mb", header: "Write (MB)" },
    { accessorKey: "username", header: "Username" },
];

interface SingleProcessCardProps {
    title: string;
    processes: ProcessInfo[] | undefined;
}

export const SingleProcessCard: React.FC<SingleProcessCardProps> = ({ title, processes }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                {processes ? (
                    <DataTable columns={columns} data={processes} />
                ) : (
                    <p>No process data available.</p>
                )}
            </CardContent>
        </Card>
    );
};
