
"use client";

import React, { useState } from "react";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import DashboardSidebar from "./sidebar";
import type { Customer, Alert, UserSession } from "@/lib/types";

interface DashboardLayoutProps {
  children: React.ReactNode;
  customers: Customer[];
  selectedDbId: string;
  onDbSelect: (id: string) => void;
  alerts: Alert[];
  session: UserSession | null;
}

export default function DashboardLayout({
  children,
  customers,
  selectedDbId,
  onDbSelect,
  alerts,
  session
}: DashboardLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <SidebarProvider>
        <div className="flex h-screen bg-background">
            <Sidebar open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                <DashboardSidebar
                    customers={customers}
                    selectedDbId={selectedDbId}
                    onDbSelect={onDbSelect}
                    alerts={alerts}
                    session={session}
                />
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
