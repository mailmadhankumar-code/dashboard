
"use client";

import React from "react";
import KpiCard from "./kpi-card";
import { Cpu, MemoryStick, Users, Server, Database as DatabaseIcon, Timer, Menu } from "lucide-react";
import type { Kpi, Database as DbType, OsInfo } from "@/lib/types";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  kpis: Kpi;
  selectedDb: (DbType & { dbStatus?: string }) | undefined;
  osInfo: OsInfo | undefined;
  dbUptime: string | undefined;
}

export default function DashboardHeader({ kpis, selectedDb, osInfo, dbUptime }: DashboardHeaderProps) {
    const { open, setOpen } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-auto min-h-16 items-center gap-4 border-b bg-background/80 p-4 backdrop-blur-lg md:px-6">
        <div className="flex items-center gap-2">
            <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setOpen(!open)}
            >
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Sidebar</span>
            </Button>
        </div>

      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-7 md:gap-4">
        <div className="col-span-2 sm:col-span-1 md:col-span-2">
            <KpiCard
              title="Database"
              value={selectedDb?.name || 'N/A'}
              subValue={selectedDb?.dbStatus}
              icon={<DatabaseIcon className="text-accent" />}
            />
        </div>
        <KpiCard
          title="Host CPU"
          value={`${kpis.cpuUsage.toFixed(2)}%`}
          icon={<Cpu className="text-accent" />}
        />
        <KpiCard
          title="Host Memory"
          value={`${kpis.memoryUsage.toFixed(2)}%`}
          subValue={kpis.memoryUsedGB !== undefined && kpis.memoryTotalGB !== undefined ? `${kpis.memoryUsedGB.toFixed(1)}G / ${kpis.memoryTotalGB.toFixed(1)}G` : ''}
          icon={<MemoryStick className="text-accent" />}
        />
        <KpiCard
          title="DB Active Sessions"
          value={kpis.activeSessions.toString()}
          icon={<Users className="text-accent" />}
        />
         <KpiCard
          title="OS Platform"
          value={osInfo?.platform || 'N/A'}
          subValue={osInfo?.release}
          icon={<Server className="text-accent" />}
        />
         <KpiCard
          title="OS Uptime"
          value={osInfo?.uptime || 'N/A'}
          icon={<Timer className="text-accent" />}
        />
        <KpiCard
            title="DB Uptime"
            value={dbUptime || 'N/A'}
            icon={<Timer className="text-accent" />}
        />
      </div>
    </header>
  );
}
