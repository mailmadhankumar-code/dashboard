import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const GlassCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <Card
    ref={ref}
    className={cn(
      "bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg transition-all duration-300 ease-in-out hover:shadow-primary/20 hover:border-border/40",
      className
    )}
    {...props}
  />
));
GlassCard.displayName = "GlassCard";

export { GlassCard, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
