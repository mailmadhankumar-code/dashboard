
"use client";

import React, { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GlassCard, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "./glass-card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Settings } from "@/lib/types";

const settingsSchema = z.object({
  tablespaceThreshold: z.coerce.number().min(1, "Must be at least 1").max(100, "Must be 100 or less"),
  diskThreshold: z.coerce.number().min(1, "Must be at least 1").max(100, "Must be 100 or less"),
});

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      tablespaceThreshold: 90,
      diskThreshold: 90,
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/settings");
        if (!response.ok) {
          throw new Error("Failed to fetch settings");
        }
        const data: Settings = await response.json();
        form.reset(data);
      } catch (error) {
        console.error(error);
        toast({
          title: "Error loading settings",
          description: "Could not fetch current settings from the server. Using defaults.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [form]);

  const onSubmit = async (values: z.infer<typeof settingsSchema>) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      toast({
        title: "Settings Saved",
        description: "Your new threshold settings have been applied.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error Saving Settings",
        description: "Could not save settings to the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
       <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-lg px-4 md:px-6 mb-6">
            <h1 className="text-xl font-semibold">Settings</h1>
       </header>
       <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <GlassCard>
            <CardHeader>
              <CardTitle>Alert Thresholds</CardTitle>
              <CardDescription>
                Configure the usage percentage at which to trigger a warning alert and highlight the component on the dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="tablespaceThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tablespace Usage Warning (%)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="90" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="diskThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disk Usage Warning (%)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="90" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSaving || isLoading}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </CardFooter>
          </GlassCard>
        </form>
       </Form>
    </div>
  );
}

    
    