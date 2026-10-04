"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsDashboard } from "@/features/crm/components/AnalyticsDashboard";
import { ReportsDashboard } from "@/features/reports/components/ReportsDashboard";

export function AnalyticsReportsContainer({ data }: { data: any }) {
    return (
        <Tabs defaultValue="overview" className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics & Reports</h1>
                    <p className="text-muted-foreground mt-1">Real-time telemetry and historical performance metrics.</p>
                </div>
                <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                    <TabsTrigger value="overview">Executive Overview</TabsTrigger>
                    <TabsTrigger value="reports">Detailed Reports</TabsTrigger>
                </TabsList>
            </div>
            
            <TabsContent value="overview" className="mt-0 outline-none">
                <AnalyticsDashboard data={data} hideHeader={true} />
            </TabsContent>
            
            <TabsContent value="reports" className="mt-0 outline-none">
                <ReportsDashboard hideHeader={true} />
            </TabsContent>
        </Tabs>
    );
}
