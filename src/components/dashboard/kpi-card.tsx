
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "../ui/badge";

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  subValue?: string;
}

export default function KpiCard({ title, value, icon, subValue }: KpiCardProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-card/60 rounded-lg border border-transparent">
        <div className="p-2 bg-primary/10 rounded-md">
            {icon}
        </div>
        <div className="overflow-hidden">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">{value}</p>
                {subValue && <Badge variant="outline" className="text-xs flex-shrink-0">{subValue}</Badge>}
            </div>
        </div>
    </div>
  );
}
