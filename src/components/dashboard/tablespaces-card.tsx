
import React from "react";
import { GlassCard, CardHeader, CardTitle, CardContent, CardDescription } from "./glass-card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Tablespace } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TablespacesCardProps {
  tablespaces: Tablespace[];
  threshold?: number;
}

const DEFAULT_THRESHOLD = 90;

export default function TablespacesCard({ tablespaces = [], threshold = DEFAULT_THRESHOLD }: TablespacesCardProps) {
  return (
    <GlassCard>
      <CardHeader>
        <CardTitle>Tablespace Usage</CardTitle>
        <CardDescription>Showing usage by percentage.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-4">
            {tablespaces.map((ts) => (
              <div key={ts.name}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">{ts.name}</span>
                  <span className={cn(
                    "text-sm text-muted-foreground",
                    ts.used_percent > threshold && "font-bold text-destructive"
                  )}>{ts.used_percent}%</span>
                </div>
                <Progress value={ts.used_percent} aria-label={`${ts.name} usage`} className={cn(ts.used_percent > threshold && "[&>div]:bg-destructive")} />
                 <div className="flex justify-between mt-1">
                  <span className="text-xs text-muted-foreground">{ts.used_gb.toFixed(2)}GB used</span>
                  <span className="text-xs text-muted-foreground">{ts.total_gb.toFixed(2)}GB total</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </GlassCard>
  );
}
