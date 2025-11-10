
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  DashboardData,
  Alert,
  ServerDataPayload,
  Customer,
  Database,
  Settings,
  UserSession,
} from "@/lib/types";
import DashboardLayout from "@/components/dashboard/dashboard-layout";
import DashboardHeader from "@/components/dashboard/header";
import CpuCard from "@/components/dashboard/cpu-card";
import HostMemoryCard from "@/components/dashboard/host-memory-card";
import IoCard from "@/components/dashboard/io-card";
import NetworkCard from "@/components/dashboard/network-card";
import TablespacesCard from "@/components/dashboard/tablespaces-card";
import RmanBackupsCard from "@/components/dashboard/rman-backups-card";
import DetailedActiveSessionsCard from "@/components/dashboard/detailed-active-sessions-card";
import AlertLogCard from "@/components/dashboard/alert-log-card";
import DiskUsageCard from "@/components/dashboard/disk-usage-card";
import TopWaitEventsCard from "@/components/dashboard/top-wait-events-card";
import ActiveSessionHistoryCard from "@/components/dashboard/active-session-history-card";
import StandbyStatusCard from "@/components/dashboard/standby-status-card";
import { toast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { DEMO_DATA_PAYLOAD } from "@/lib/demo-data";
import { deepCopy } from "@/lib/utils";

type StatusPayload = {
    [key: string]: {
        dbIsUp: boolean;
        osIsUp: boolean;
    }
}

export default function Home() {
  const { session, isLoading: isSessionLoading } = useSession();
  const [allData, setAllData] = useState<ServerDataPayload>({});
  const [selectedDbId, setSelectedDbId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitchingDb, setIsSwitchingDb] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const isDemoMode = session?.username === 'demo';

  // --- Data Fetching Functions ---
  const fetchAllStatuses = useCallback(async () => {
    try {
        const response = await fetch('/api/data/status');
        if (!response.ok) throw new Error('Failed to fetch statuses');
        const statusData: StatusPayload = await response.json();
        
        setCustomers(prev => {
            if (prev.length === 0) return []; // Don't update if customers aren't loaded yet
            const newCustomers = deepCopy(prev);
            newCustomers.forEach(cust => {
                cust.databases.forEach(db => {
                    const status = statusData[db.id];
                    if (status) {
                        db.isUp = status.dbIsUp;
                        db.osUp = status.osIsUp;
                    } else {
                        db.isUp = false;
                        db.osUp = false;
                    }
                });
            });
            return newCustomers;
        });

    } catch (error) {
        console.error("Failed to fetch statuses:", error);
    }
  }, []);

  const fetchDbData = useCallback(async (dbId: string) => {
      if (isDemoMode) {
          // In demo mode, data is already loaded, just update state
          setAllData(DEMO_DATA_PAYLOAD);
          return true;
      }
      try {
        const dataResponse = await fetch(`/api/data/${dbId}`);
        if (!dataResponse.ok) throw new Error(`HTTP error! status: ${dataResponse.status}`);
        const result = await dataResponse.json();
        setAllData(prev => ({ ...prev, [dbId]: result }));
        return true;
      } catch (error) {
        console.error(`Failed to fetch data for ${dbId}:`, error);
        setAllData(prev => ({
            ...prev,
            [dbId]: {
                ...(prev[dbId] || {}),
                data: {
                    ...(prev[dbId]?.data || { id: dbId }),
                    dbIsUp: false,
                    osIsUp: false,
                }
            }
        }));
        return false;
      }
  }, [isDemoMode]);

  const handleDbSelect = useCallback(async (dbId: string) => {
    if (dbId === selectedDbId) return;
    
    setIsSwitchingDb(true);
    await fetchDbData(dbId);
    setSelectedDbId(dbId);
    setIsSwitchingDb(false);
  }, [selectedDbId, fetchDbData]);

  // --- Step 1: Initial Load: Fetch settings, then data for the first DB ---
  useEffect(() => {
    const fetchInitialData = async (userSession: UserSession) => {
      if (!userSession) return;
      setIsLoading(true);
      
      const currentIsDemoMode = userSession.username === 'demo';

      try {
        const settingsResponse = await fetch('/api/settings');
        if (!settingsResponse.ok) throw new Error('Failed to fetch settings');
        const settingsData: Settings = await settingsResponse.json();
        setSettings(settingsData);
        
        const allCustomers = settingsData?.emailSettings?.customers || [];
        let visibleCustomers = allCustomers;
        if (userSession.role === 'user' && userSession.customerIds) {
            visibleCustomers = allCustomers.filter(c => userSession.customerIds?.includes(c.id));
        }
        const initialCustomers = visibleCustomers.map(c => ({...c, databases: c.databases.map(db => ({...db, isUp: false, osUp: false}))}));
        
        const firstDbId = initialCustomers?.[0]?.databases?.[0]?.id || null;
        
        if (currentIsDemoMode) {
          setAllData(DEMO_DATA_PAYLOAD);
          const demoCustomers = initialCustomers.map(c => {
             c.databases.forEach(db => {
                  const demoDbData = DEMO_DATA_PAYLOAD[db.id];
                  if (demoDbData) {
                    db.isUp = demoDbData.data.dbIsUp;
                    db.osUp = demoDbData.data.osIsUp;
                  }
              });
              return c;
          });
          setCustomers(demoCustomers);
          if(firstDbId) setSelectedDbId(firstDbId);

        } else {
            setCustomers(initialCustomers);
            if (firstDbId) {
                // Fetch statuses and first DB data in parallel for faster initial load
                await Promise.all([
                    fetchDbData(firstDbId),
                    fetchAllStatuses()
                ]);
                setSelectedDbId(firstDbId);
            } else {
                // If no DBs, still fetch statuses for the sidebar
                await fetchAllStatuses();
            }
        }
        
      } catch (error) {
        console.error("Failed to fetch initial page data:", error);
        toast({
          title: "Could not load initial data",
          description: "There was an error fetching settings or server data.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    if (!isSessionLoading && session) {
        fetchInitialData(session);
    }
  }, [isSessionLoading, session, fetchAllStatuses, fetchDbData]);


  // --- Step 2: Set up intervals for polling ---
  useEffect(() => {
    if (isDemoMode || !selectedDbId) return;

    const dataInterval = setInterval(() => {
        fetchDbData(selectedDbId);
    }, 30000); 
    
    return () => clearInterval(dataInterval);
  }, [isDemoMode, selectedDbId, fetchDbData]);

  useEffect(() => {
    if (isDemoMode) return;
    
    const statusInterval = setInterval(fetchAllStatuses, 60000);
    
    return () => clearInterval(statusInterval);
  }, [isDemoMode, fetchAllStatuses]);


  // --- Step 3: Generate Alerts based on data and settings ---
  useEffect(() => {
    if (!settings || Object.keys(allData).length === 0) return;

    const newAlerts: Alert[] = [];
    const customerDbs = settings?.emailSettings?.customers || [];
    const customerMap = new Map<string, string>();

    customerDbs.forEach(c => {
        c.databases.forEach(db => {
            customerMap.set(db.id, c.name);
        });
    });

    Object.values(allData).forEach(server => {
        const data = server.data;
        if (!data || !data.id) return;
        
        if (session && session.role === 'user' && session.customerIds) {
            const isVisible = customerDbs.some(c => 
                session.customerIds?.includes(c.id) && c.databases.some(db => db.id === data.id)
            );
            if (!isVisible) return;
        }

        const customerName = customerMap.get(data.id) || "Unknown Customer";
        const dbName = data.dbName || data.id;

        if (!data.dbIsUp) newAlerts.push({id: `status-db-${data.id}`, type: 'error', title: 'Database Down', message: `${customerName} - ${dbName}`});
        if (!data.osIsUp) newAlerts.push({id: `status-os-${data.id}`, type: 'error', title: 'OS Unreachable', message: `${customerName} - ${dbName}`});

        if (data.kpis?.cpuUsage > settings.thresholds.cpu) newAlerts.push({ id: `cpu-${data.id}`, type: 'warning', title: 'High CPU Usage', message: `${customerName} - ${dbName} (${data.kpis.cpuUsage.toFixed(1)}%)` });
        if (data.kpis?.memoryUsage > settings.thresholds.memory) newAlerts.push({ id: `mem-${data.id}`, type: 'warning', title: 'High Memory Usage', message: `${customerName} - ${dbName} (${data.kpis.memoryUsage.toFixed(1)}%)` });

        data.backups?.forEach(backup => {
            if (backup.status === 'FAILED') {
                newAlerts.push({ id: `backup-${backup.id}`, type: 'error', title: 'Backup Failed', message: `${customerName} - ${dbName}` });
            }
        });
        
        data.tablespaces?.forEach(ts => {
            if (ts.used_percent > settings.tablespaceThreshold) {
                newAlerts.push({ id: `ts-${data.id}-${ts.name}`, type: 'warning', title: 'Tablespace Alert', message: `${customerName} - ${dbName}: ${ts.name} is ${ts.used_percent}% full.` });
            }
        });
        
        data.alertLog?.forEach(log => {
             newAlerts.push({ id: `log-${log.id}`, type: 'error', title: 'ORA- Error', message: `${customerName} - ${dbName}: ${log.error_code}` });
        });
        
        data.diskUsage?.forEach(disk => {
            if (disk.used_percent > settings.diskThreshold) {
                newAlerts.push({ id: `disk-${data.id}-${disk.mount_point}`, type: 'warning', title: 'Disk Usage Alert', message: `${customerName} - ${dbName}: ${disk.mount_point} is ${disk.used_percent}% full.` });
            }
        });
    });
    setAlerts(newAlerts);
  }, [allData, settings, session]);

  const selectedDbData = selectedDbId ? allData[selectedDbId]?.data : undefined;
  
  const selectedDbInfo: Partial<Database> & { osType?: string; dbStatus?: string } = {
      ...(customers.flatMap(c => c.databases).find(db => db.id === selectedDbId) || {}),
      osType: selectedDbData?.osInfo?.platform || 'N/A',
      dbStatus: selectedDbData?.dbStatus || 'UNKNOWN'
  };

  const renderContent = () => {
      if (isLoading || isSessionLoading) {
          return <div className="p-4 md:p-6 text-center text-muted-foreground">Loading dashboard...</div>;
      }
      if (isSwitchingDb) {
          return <div className="p-4 md:p-6 text-center text-muted-foreground">Loading data...</div>;
      }
      if (!selectedDbId || !selectedDbData) {
           return (
             <div className="p-4 md:p-6 text-center text-muted-foreground">
                {customers.length > 0 ? "Please select a database from the sidebar to view its details." : "No customers or databases are configured for your user."}
             </div>
           );
      }
      return (
        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="md:col-span-2 lg:col-span-2">
              <ActiveSessionHistoryCard sessionHistory={selectedDbData.activeSessionsHistory} />
          </div>
          <div className="md:col-span-2 lg:col-span-2">
              <TopWaitEventsCard waitEvents={selectedDbData.topWaitEvents} />
          </div>
          <CpuCard data={selectedDbData.performance?.cpu} />
          <HostMemoryCard data={selectedDbData.performance?.memory} />
          <IoCard readData={selectedDbData.performance?.io_read} writeData={selectedDbData.performance?.io_write} diskUsage={selectedDbData.diskUsage} />
          <NetworkCard upData={selectedDbData.performance?.network_up} downData={selectedDbData.performance?.network_down} />
          <div className="md:col-span-2 lg:col-span-4">
              <DetailedActiveSessionsCard sessions={selectedDbData.detailedActiveSessions} />
          </div>
          <TablespacesCard tablespaces={selectedDbData.tablespaces} threshold={settings?.tablespaceThreshold} />
          <AlertLogCard alerts={selectedDbData.alertLog} />
          <DiskUsageCard diskUsage={selectedDbData.diskUsage} threshold={settings?.diskThreshold} />
          <div className="md:col-span-2 lg:col-span-4">
              <RmanBackupsCard backups={selectedDbData.backups} />
          </div>
          {selectedDbData.standbyStatus && selectedDbData.standbyStatus.length > 0 && (
              <div className="md:col-span-2 lg:col-span-4">
                  <StandbyStatusCard standbyStatus={selectedDbData.standbyStatus} />
              </div>
          )}
        </div>
      );
  }

  return (
    <DashboardLayout
      customers={customers}
      selectedDbId={selectedDbId || ""}
      onDbSelect={handleDbSelect}
      alerts={alerts}
      session={session}
    >
      <DashboardHeader kpis={selectedDbData?.kpis || {cpuUsage: 0, memoryUsage: 0, activeSessions: 0}} selectedDb={selectedDbInfo} />
      {renderContent()}
    </DashboardLayout>
  );
}

    