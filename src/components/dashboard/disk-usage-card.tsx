
import React from "react";
import { GlassCard, CardHeader, CardTitle, CardContent, CardDescription } from "./glass-card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DiskUsage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DiskUsageCardProps {
  diskUsage: DiskUsage[];
  threshold?: number;
}

const DEFAULT_THRESHOLD = 90;

export default function DiskUsageCard({ diskUsage = [], threshold = DEFAULT_THRESHOLD }: DiskUsageCardProps) {
  return (
    <GlassCard>
      <CardHeader>
        <CardTitle>Disk Usage</CardTitle>
        <CardDescription>OS-level drive/mount point usage.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-4">
            {diskUsage.map((disk) => (
              <div key={disk.mount_point}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium font-code">{disk.mount_point}</span>
                  <span className={cn(
                      "text-sm text-muted-foreground",
                      disk.used_percent > threshold && "font-bold text-destructive"
                  )}>{disk.used_percent}%</span>
                </div>
                <Progress value={disk.used_percent} aria-label={`${disk.mount_point} usage`} className={cn(disk.used_percent > threshold && "[&>div]:bg-destructive")} />
                 <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                  <span>{disk.used_gb.toFixed(2)}GB used</span>
                  <span>{(disk.total_gb - disk.used_gb).toFixed(2)}GB free</span>
                  <span>{disk.total_gb.toFixed(2)}GB total</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </GlassCard>
  );
}
