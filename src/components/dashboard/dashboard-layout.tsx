
"use client";

import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
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
  return (
    <SidebarProvider>
      <DashboardSidebar
        customers={customers}
        selectedDbId={selectedDbId}
        onDbSelect={onDbSelect}
        alerts={alerts}
        session={session}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
