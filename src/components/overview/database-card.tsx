
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cpu, MemoryStick, Server, AlertTriangle } from "lucide-react";
import { DashboardData } from "@/lib/types";
import { DatabaseDetailsPopup } from "./database-details-popup";

interface DatabaseCardProps {
  customerName: string;
  dbName: string;
  dbId: string;
}

const StatusIndicator = ({ label, isUp, uptime }: { label: string, isUp: boolean, uptime?: string }) => (
    <div className="flex items-center text-sm space-x-2">
        <div className={`w-3 h-3 rounded-full ${isUp ? 'bg-green-500' : 'bg-red-500'}`} />
        <div className="flex items-baseline justify-between w-16">
          <span className="font-semibold">{label}:</span>
          <span className={`${isUp ? 'text-green-500' : 'text-red-500'}`}>
              {isUp ? 'Up' : 'Down'}
          </span>
        </div>
        {uptime && <span className="text-xs text-muted-foreground">({uptime})</span>}
    </div>
);

export function DatabaseCard({ customerName, dbName, dbId }: DatabaseCardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/data/${dbId}?minimal=true`);
        const result = await response.json();
        if (result && result.data) {
          setData(result.data);
        } else {
          // Set a default down state if fetch fails or data is invalid
          setData({ id: dbId, dbIsUp: false, osIsUp: false });
        }
      } catch (error) {
        console.error(`Failed to fetch data for ${dbName}:`, error);
        setData({ id: dbId, dbIsUp: false, osIsUp: false });
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [dbId, dbName]);

  if (!data) {
    // Render a placeholder or null until data is first loaded
    return null;
  }

  const { dbIsUp, osIsUp, kpis, osInfo, diskUsage, dbStatus } = data;
  const highUsageDisks = diskUsage?.filter(d => d.used_percent > 80).sort((a,b) => b.used_percent - a.used_percent) || [];

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-muted-foreground">{customerName}</p>
                    <CardTitle className="text-lg">{dbName}</CardTitle>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <StatusIndicator label="DB" isUp={dbIsUp} uptime={dbStatus} />
                    <StatusIndicator label="OS" isUp={osIsUp} uptime={osInfo?.uptime} />
                </div>
            </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm flex-grow">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-muted-foreground" />
            <span>CPU: {kpis?.cpuUsage.toFixed(1)}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <MemoryStick className="w-5 h-5 text-muted-foreground" />
            <span>Mem: {kpis?.memoryUsage.toFixed(1)}%</span>
          </div>
          <div className="flex items-center space-x-2 col-span-2">
            <Server className="w-5 h-5 text-muted-foreground" />
            <span className="truncate">{osInfo?.platform} {osInfo?.release}</span>
          </div>
          {highUsageDisks.length > 0 && (
              <div className="col-span-2 mt-2">
                   <div className="flex items-center space-x-2 mb-1">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <h4 className="font-semibold">High Disk Usage</h4>
                  </div>
                  <div className="pl-4 border-l-2 border-destructive space-y-1">
                  {highUsageDisks.map(disk => (
                      <div key={disk.mount_point} className="flex items-center justify-between space-x-2">
                          <span className="font-mono text-xs truncate">{disk.mount_point}</span>
                          <Badge variant="destructive" className="text-xs">{disk.used_percent}%</Badge>
                      </div>
                  ))}
                   </div>
              </div>
          )}
        </CardContent>
        <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => setIsDetailsOpen(true)}>
                Details
            </Button>
        </CardFooter>
      </Card>
      {isDetailsOpen && (
        <DatabaseDetailsPopup
          customerName={customerName}
          dbName={dbName}
          data={data}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </>
  );
}
