
"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "@/hooks/use-session";
import { getSettingsAction, getDashboardDataAction } from "@/app/actions";
import type { DashboardData, Settings } from "@/lib/types";
import DashboardLayout from "@/components/dashboard/dashboard-layout";
import { toast } from "@/hooks/use-toast";
import { useParams } from "next/navigation";
import Header from "@/components/dashboard/header";
import KpiCard, { KpiProvider } from "@/components/dashboard/kpi-card";
import CpuCard from "@/components/dashboard/cpu-card";
import MemoryCard from "@/components/dashboard/memory-card";
import IoCard from "@/components/dashboard/io-card";
import NetworkCard from "@/components/dashboard/network-card";
import HostMemoryCard from "@/components/dashboard/host-memory-card";
import AlertLogCard from "@/components/dashboard/alert-log-card";
import ActiveSessionsCard from "@/components/dashboard/active-sessions-card";
import RmanBackupsCard from "@/components/dashboard/rman-backups-card";
import TablespacesCard from "@/components/dashboard/tablespaces-card";
import StandbyStatusCard from "@/components/dashboard/standby-status-card";
import TopWaitEventsCard from "@/components/dashboard/top-wait-events-card";
import OsOverviewCard from "@/components/dashboard/os-overview-card";
import { TopProcessesCard } from "@/components/dashboard/top-processes-card";
import DiskUsageCard from "@/components/dashboard/disk-usage-card";

export default function DashboardPage() {
  const { session } = useSession();
  const params = useParams();
  const dbId = params.dbId as string;

  const [data, setData] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    getSettingsAction().then(res => {
      if (res.data) setSettings(res.data);
      else if (res.error) toast({ title: "Could not load settings", description: res.error, variant: "destructive" });
    });
  }, []);

  useEffect(() => {
    if (session && dbId) {
      const fetchData = () => {
        getDashboardDataAction(dbId)
          .then((res) => {
            if (res.data) {
              setData(res.data);
              setLastUpdated(new Date().toLocaleTimeString());
            } else if (res.error) {
              setData(null); 
              toast({ title: "Error Fetching Data", description: res.error, variant: "destructive" });
            }
          })
          .catch((err) => toast({ title: "Client-Side Error", description: err.message, variant: "destructive" }));
      };

      fetchData();
      const interval = setInterval(fetchData, 15000);

      return () => clearInterval(interval);
    }
  }, [session, dbId]);
  
  const kpiData = data ? { ...data.kpis, dbName: data.dbName, instanceName: data.instanceName } : { dbName: data?.dbName };

  return (
    <DashboardLayout session={session}>
      <Header 
        dbName={data?.dbName || dbId} 
        lastUpdated={lastUpdated} 
        instanceName={data?.instanceName} 
        hostName={data?.hostName}
        osInfo={data?.osInfo} 
      />
      {data ? (
        <main className="flex-1 p-4 md:p-6">
          <div className="grid gap-4 md:gap-6 lg:grid-cols-2 xl:grid-cols-4">
            <KpiProvider kpis={kpiData}>
                <KpiCard kpiKey="logins" title="Logins" />
                <KpiCard kpiKey="commits" title="Commits" />
                <KpiCard kpiKey="rollbacks" title="Rollbacks" />
                <KpiCard kpiKey="activeSessions" title="Active Sessions" />
            </KpiProvider>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 mt-4 md:mt-6">
            <OsOverviewCard osInfo={data.osInfo} />
            <StandbyStatusCard standbyStatus={data.standbyStatus} />
          </div>

          <div className="grid gap-4 md:gap-6 lg:grid-cols-2 xl:grid-cols-4 mt-4 md:mt-6">
            <CpuCard data={data.cpu} />
            <MemoryCard data={data.memory} />
            <IoCard data={data.io} />
            <NetworkCard data={data.network} />
          </div>

          <div className="grid gap-4 md:gap-6 mt-4 md:mt-6">
             <HostMemoryCard data={data.hostMemory} />
          </div>
          
          <div className="grid gap-4 md:gap-6 lg:grid-cols-2 xl:grid-cols-3 mt-4 md:mt-6">
            <ActiveSessionsCard data={data.activeSessions} />
            <TopWaitEventsCard data={data.topWaitEvents} />
            <AlertLogCard data={data.alertLog} />
            <TablespacesCard data={data.tablespaces} threshold={settings?.tablespaceThreshold} />
            <RmanBackupsCard data={data.rmanBackups} />
            <DiskUsageCard data={data.diskUsage} threshold={settings?.diskUsageThreshold} />
          </div>

          <div className="grid gap-4 md:gap-6 mt-4 md:mt-6">
            <TopProcessesCard 
              topCpuProcesses={data.topCpuProcesses} 
              topMemoryProcesses={data.topMemoryProcesses} 
              topIoProcesses={data.topIoProcesses} 
            />
          </div>
        </main>
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-lg text-muted-foreground">Loading dashboard...</p>
        </div>
      )}
    </DashboardLayout>
  );
}
