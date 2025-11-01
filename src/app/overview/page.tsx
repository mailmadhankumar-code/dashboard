
"use client";

import React, { useState, useEffect } from "react";
import { Customer, Alert } from "@/lib/types";
import { useSession } from "@/hooks/use-session";
import { getSettingsAction } from "@/app/actions";
import { DatabaseCard } from "@/components/overview/database-card";
import DashboardLayout from "@/components/dashboard/dashboard-layout";


export default function OverviewPage() {
  const { session } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dummy state for layout props - you might want to fetch real data
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    async function fetchCustomers() {
      if (!session) return;
      setIsLoading(true);

      try {
        const settingsResult = await getSettingsAction();
        if (settingsResult.error || !settingsResult.data) throw new Error("Failed to fetch settings");

        let visibleCustomers = settingsResult.data.emailSettings?.customers || [];
        if (session.role === "user" && session.customerIds) {
          visibleCustomers = visibleCustomers.filter(c => session.customerIds?.includes(c.id));
        }
        setCustomers(visibleCustomers);

      } catch (error) {
        console.error("Failed to fetch customer data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCustomers();
    
  }, [session]);
  
  const renderContent = () => {
      if (isLoading) {
        return <div className="p-4 md:p-6 text-center text-muted-foreground">Loading overview...</div>;
      }
      
      const visibleDatabases = customers.flatMap(c => c.databases.map(db => ({...db, customerName: c.name})) );

      return (
        <div className="p-4 md:p-6">
          <h1 className="text-2xl font-bold mb-4">Server and Database Overview</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {visibleDatabases.map(db => (
                <DatabaseCard key={db.id} customerName={db.customerName} dbName={db.name} dbId={db.id} />
              ))
            }
          </div>
        </div>
      );
  }

  return (
    <DashboardLayout
      customers={customers}
      selectedDbId={null} // No specific DB is selected on the overview
      onDbSelect={() => {}} // No action needed on DB select from sidebar
      alerts={alerts} // Pass real alerts if available
      session={session}
    >
      {/* The header is omitted to provide a cleaner overview page */}
      {renderContent()}
    </DashboardLayout>
  );
}
