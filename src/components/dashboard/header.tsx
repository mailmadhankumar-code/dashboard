

"use client";

import React from "react";
import KpiCard from "./kpi-card";
import { Cpu, MemoryStick, Users, Server, Database as DatabaseIcon } from "lucide-react";
import type { Kpi, Database } from "@/lib/types";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface DashboardHeaderProps {
  kpis: Kpi;
  selectedDb: (Database & { dbStatus?: string }) | undefined;
}

export default function DashboardHeader({ kpis, selectedDb }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-auto min-h-16 items-center gap-4 border-b bg-background/80 p-4 backdrop-blur-lg md:px-6">
      <SidebarTrigger className="md:hidden" />
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 md:gap-4">
        <KpiCard
          title="Database"
          value={selectedDb?.name || 'N/A'}
          subValue={selectedDb?.dbStatus}
          icon={<DatabaseIcon className="text-accent" />}
        />
        <KpiCard
          title="Host CPU"
          value={`${kpis.cpuUsage.toFixed(2)}%`}
          icon={<Cpu className="text-accent" />}
        />
        <KpiCard
          title="Host Memory"
          value={`${kpis.memoryUsage.toFixed(2)}%`}
          icon={<MemoryStick className="text-accent" />}
        />
        <KpiCard
          title="DB Active Sessions"
          value={kpis.activeSessions.toString()}
          icon={<Users className="text-accent" />}
        />
         <KpiCard
          title="OS Platform"
          value={selectedDb?.osType || 'N/A'}
          icon={<Server className="text-accent" />}
        />
      </div>
    </header>
  );
}

    
