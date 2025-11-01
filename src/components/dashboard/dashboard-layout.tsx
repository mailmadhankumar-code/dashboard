
"use client";

import React from "react";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import DashboardSidebar from "./sidebar";
import { useCustomers } from "@/hooks/use-customers";
import type { UserSession } from "@/lib/types";

interface DashboardLayoutProps {
  children: React.ReactNode;
  session: UserSession | null;
}

/**
 * The main layout for the dashboard. It provides the sidebar navigation and the main content area.
 * It now fetches its own customer data, so it is no longer dependent on the page to provide it.
 */
export default function DashboardLayout({ children, session }: DashboardLayoutProps) {
  const { customers, isLoading, error } = useCustomers();

  // Here you could handle the loading and error states, for example:
  if (isLoading) {
    return <div>Loading sidebar data...</div>;
  }

  if (error) {
    return <div>Error loading sidebar data: {error.message}</div>;
  }

  return (
    <SidebarProvider>
        <div className="flex h-screen bg-background">
            <Sidebar>
                <DashboardSidebar session={session} customers={customers || []} />
            </Sidebar>

            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto">
                    <SidebarInset>
                        {children}
                    </SidebarInset>
                </main>
            </div>
        </div>
    </SidebarProvider>
  );
}
