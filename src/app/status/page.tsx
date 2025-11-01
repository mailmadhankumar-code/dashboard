
"use client";

import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/dashboard-layout";
import { useSession } from "@/hooks/use-session";
import { toast } from "@/hooks/use-toast";
import type { Customer, Alert, Settings, OverviewRow } from "@/lib/types";
import { Server, Loader2, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { getOverviewData } from "@/app/actions";

const StatusIndicator = ({ isUp }: { isUp: boolean }) => (
    <Badge variant={isUp ? "default" : "destructive"} className={isUp ? "bg-green-500" : "bg-red-500"}>
        {isUp ? "Up" : "Down"}
    </Badge>
);

export default function StatusPage() {
  const { session, isLoading: isSessionLoading } = useSession();
  const [data, setData] = useState<OverviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [alerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (isSessionLoading || !session) return;

    const fetchInitialData = async () => {
      try {
        const settingsResponse = await fetch("/api/settings");
        if (!settingsResponse.ok) throw new Error("Failed to fetch settings");
        const settingsData: Settings = await settingsResponse.json();

        let allCustomers = settingsData?.emailSettings?.customers || [];
        if (session.role === "user" && session?.customerIds) {
          allCustomers = allCustomers.filter((c) =>
            session.customerIds?.includes(c.id)
          );
        }

        const initialCustomers = allCustomers.map((c) => ({
          ...c,
          databases: c.databases.map((db) => ({ ...db, isUp: false, osUp: false })),
        }));
        setCustomers(initialCustomers);
      } catch (error) {
        console.error("Failed to fetch initial settings for sidebar:", error);
      }
    };
    fetchInitialData();
  }, [isSessionLoading, session]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const result = await getOverviewData();

        if (result.error) {
            if (result.error === 'Unauthorized') {
                router.push('/login');
            } else {
                throw new Error(`Failed to fetch overview data: ${result.error}`);
            }
            return;
        }

        if (result.data) {
            setData(result.data);
             setCustomers(prevCustomers => {
                return prevCustomers.map(c => ({
                    ...c,
                    databases: c.databases.map(db => {
                        const overviewData = result.data!.find(d => d.id === db.id);
                        return {
                            ...db,
                            isUp: overviewData?.dbIsUp ?? false,
                            osUp: overviewData?.osIsUp ?? false,
                        };
                    })
                }));
            });
        }
      } catch (error) {
        console.error(error);
        toast({
          title: "Error fetching data",
          description: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if(session) {
      fetchData();
      const interval = setInterval(fetchData, 15000); // Poll every 15 seconds
      return () => clearInterval(interval);
    }
  }, [session, router]);

  const handleDbSelect = useCallback(
    (dbId: string) => {
      router.push(`/dashboard/${dbId}`);
    },
    [router]
  );

  const firstDb = data.length > 0 ? data[0] : null;

  return (
    <DashboardLayout
      customers={customers}
      selectedDbId={""}
      onDbSelect={handleDbSelect}
      alerts={alerts}
      session={session}
    >
      <header className="sticky top-0 z-10 flex h-auto min-h-16 items-center gap-4 border-b bg-background/80 p-4 backdrop-blur-lg md:px-6">
        <h1 className="text-xl font-semibold">Database Status</h1>
        {firstDb && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                <Timer className="h-4 w-4" />
                <span>{firstDb.dbName} Uptime: {firstDb.uptime}</span>
            </div>
        )}
      </header>

      <main className="flex-1 p-4 md:p-6">
       <Card>
        <CardHeader>
            <CardTitle>All Databases</CardTitle>
            <CardDescription>A list of all monitored databases and their current status.</CardDescription>
        </CardHeader>
        <CardContent>
        {isLoading && data.length === 0 ? (
          <div className="flex justify-center items-center h-full py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Loading database status...</p>
            </div>
          </div>
        ) : data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Database</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>DB Status</TableHead>
                <TableHead>OS Status</TableHead>
                <TableHead>DB State</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>Memory</TableHead>
                <TableHead>Uptime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((db) => (
                <TableRow key={db.id} onClick={() => handleDbSelect(db.id)} className="cursor-pointer">
                  <TableCell className="font-medium whitespace-nowrap" title={db.dbName}>{db.dbName}</TableCell>
                  <TableCell>{db.customerName}</TableCell>
                  <TableCell><StatusIndicator isUp={db.dbIsUp} /></TableCell>
                  <TableCell><StatusIndicator isUp={db.osIsUp} /></TableCell>
                  <TableCell><Badge variant="outline">{db.dbStatus}</Badge></TableCell>
                  <TableCell>{db.cpuUsage.toFixed(1)}%</TableCell>
                  <TableCell>{db.memoryUsage.toFixed(1)}%</TableCell>
                  <TableCell>{db.uptime}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex justify-center items-center h-full py-8">
            <div className="text-center">
              <Server className="h-12 w-12 mx-auto text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">No Databases Found</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                No databases are configured for your account.
              </p>
            </div>
          </div>
        )}
        </CardContent>
       </Card>
      </main>
    </DashboardLayout>
  );
}
