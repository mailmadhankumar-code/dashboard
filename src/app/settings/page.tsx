
"use client";

import React, { useState, useEffect } from "react";
import {
  initialData,
  DashboardData,
  Alert,
} from "@/lib/mock-data";
import DashboardLayout from "@/components/dashboard/dashboard-layout";
import SettingsPage from "@/components/dashboard/settings-page";
import { toast } from "@/hooks/use-toast";
import { Settings as AppSettings, Customer } from "@/lib/types";

export default function Settings() {
  const [data, setData] = useState<DashboardData>(initialData);
  const [selectedDbId, setSelectedDbId] = useState<string>("db1");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // We still need to fetch customer data for the sidebar, even on the settings page
   useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const settingsRes = await fetch('/api/settings');
        if (!settingsRes.ok) throw new Error('Failed to fetch settings');
        const settingsData: AppSettings = await settingsRes.json();
        
        if (settingsData.emailSettings?.customers) {
            // Initially, we just need the structure, statuses will be updated
            const initialCustomers = settingsData.emailSettings.customers.map(c => ({
                ...c,
                databases: c.databases.map(db => ({...db, isUp: false, osUp: false}))
            }));
            setCustomers(initialCustomers);

            // Set initial selected DB
            if (initialCustomers?.[0]?.databases?.[0]?.id) {
                setSelectedDbId(initialCustomers[0].databases[0].id);
            }
        }
        
        const dataRes = await fetch(`/api/data`);
        if (!dataRes.ok) throw new Error('Failed to fetch server data');
        const allServerData = await dataRes.json();

        // Update statuses
        setCustomers(prevCustomers => {
            return prevCustomers.map(customer => ({
                ...customer,
                databases: customer.databases.map(db => {
                    const serverInfo = allServerData[db.id];
                    if (serverInfo && serverInfo.data) {
                        return { ...db, isUp: serverInfo.data.dbIsUp, osUp: serverInfo.data.osIsUp };
                    }
                    return db;
                })
            }));
        });


      } catch (error) {
        console.error("Failed to fetch initial data for sidebar:", error);
         toast({
            title: "Connection Error",
            description: "Could not fetch server list for sidebar.",
            variant: "destructive"
        });
      }
    };
    fetchInitialData();
  }, []);


  return (
    <DashboardLayout
      customers={customers}
      selectedDbId={selectedDbId}
      onDbSelect={setSelectedDbId}
      alerts={alerts}
    >
        <SettingsPage />
    </DashboardLayout>
  );
}
