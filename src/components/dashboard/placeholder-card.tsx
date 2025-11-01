import { GlassCard, CardContent } from "./glass-card";
import { Info } from "lucide-react";

export default function PlaceholderCard({ title, description }: { title: string, description?: string }) {
  return (
    <GlassCard className="flex items-center justify-center">
      <CardContent className="text-center text-muted-foreground p-6">
        <Info className="mx-auto h-12 w-12" />
        <h3 className="mt-4 text-lg font-medium text-foreground">{title}</h3>
        <p className="mt-1 text-sm">{description || "This feature is coming soon."}</p>
      </CardContent>
    </GlassCard>
  );
}
