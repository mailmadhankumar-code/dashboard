
"use client";

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarSeparator,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Database, Server, Building, Activity, AlertTriangle, ShieldAlert, Settings, LogOut } from "lucide-react";
import type { Customer, Alert, UserSession } from "@/lib/types";
import { Badge } from "../ui/badge";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "../ui/button";

interface DashboardSidebarProps {
  customers: Customer[];
  selectedDbId: string;
  onDbSelect: (id: string) => void;
  alerts: Alert[];
  session: UserSession | null;
}

const StatusIndicator = ({ isUp }: { isUp: boolean }) => (
  <div
    className={`w-2 h-2 rounded-full ${
      isUp ? "bg-green-500" : "bg-red-500"
    }`}
  />
);

const AlertIcon = ({ type }: { type: 'warning' | 'error' }) => {
    if (type === 'error') {
        return <ShieldAlert className="w-4 h-4 text-destructive" />;
    }
    return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
}

export default function DashboardSidebar({
  customers,
  selectedDbId,
  onDbSelect,
  alerts,
  session,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };
  
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-accent/50 text-accent flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            <h1 className="text-lg font-semibold tracking-tight">
              ProactiveDB
            </h1>
          </Badge>
          <div className="grow" />
          <SidebarTrigger className="md:hidden" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <Accordion type="multiple" defaultValue={[...customers.map(c => c.id), 'alerts', 'management']} className="w-full">
          {customers.map((customer) => (
            <AccordionItem value={customer.id} key={customer.id} className="border-none">
              <AccordionTrigger className="px-2 hover:no-underline hover:bg-sidebar-accent rounded-md text-sm">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  <span>{customer.name}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <SidebarMenu>
                  {customer.databases.map((db) => (
                    <SidebarMenuItem key={db.id}>
                      <Link href="/" passHref>
                        <SidebarMenuButton
                            onClick={() => onDbSelect(db.id)}
                            isActive={selectedDbId === db.id && pathname === "/"}
                            className="justify-between"
                        >
                            <span className="flex items-center gap-2">
                            <Database className="w-4 h-4" />
                            {db.name}
                            </span>
                            <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">DB</span>
                            <StatusIndicator isUp={db.isUp} />
                            <span className="text-xs text-muted-foreground">OS</span>
                            <StatusIndicator isUp={db.osUp} />
                            </div>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </AccordionContent>
            </AccordionItem>
          ))}
          <SidebarSeparator />
          <AccordionItem value="alerts" className="border-none">
              <AccordionTrigger className="px-2 hover:no-underline hover:bg-sidebar-accent rounded-md text-sm">
                  <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Recent Alerts</span>
                      {alerts.length > 0 && <Badge variant="destructive" className="ml-2">{alerts.length}</Badge>}
                  </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 text-sidebar-foreground">
              <SidebarMenu>
                  {alerts.length === 0 ? (
                      <p className="px-2 text-xs text-muted-foreground">No recent alerts.</p>
                  ) : (
                      alerts.map(alert => (
                          <SidebarMenuItem key={alert.id}>
                              <div className="flex items-start gap-3 p-2 text-xs">
                                  <AlertIcon type={alert.type} />
                                  <div>
                                      <p className="font-semibold">{alert.title}</p>
                                      <p className="text-muted-foreground">{alert.message}</p>
                                  </div>
                              </div>
                          </SidebarMenuItem>
                      ))
                  )}
              </SidebarMenu>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="management" className="border-none">
             <AccordionTrigger className="px-2 hover:no-underline hover:bg-sidebar-accent rounded-md text-sm">
                    <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        <span>Management</span>
                    </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <Link href="/settings" passHref>
                           <SidebarMenuButton isActive={pathname === "/settings"}>
                                <Settings className="w-4 h-4" />
                                Settings
                           </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                </SidebarMenu>
              </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-2 p-2">
            {session && (
              <div className="text-center text-xs text-muted-foreground p-2 border border-dashed rounded-md">
                <p className="font-semibold text-foreground truncate">{session.username || session.email}</p>
                <p>Role: {session.role}</p>
              </div>
            )}
            <Button onClick={handleLogout} variant="outline" size="sm" className="w-full">
                <LogOut />
                <span>Logout</span>
            </Button>
            <p className="text-xs text-muted-foreground text-center p-2">
                Copyright © {new Date().getFullYear()} Krizars Private Limited
            </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
