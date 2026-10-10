"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/features/audit/actions";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [incidentId, setIncidentId] = useState<string | null>(null);

  useEffect(() => {
    reportClientError({
      message: error.message || "Dashboard rendering exception",
      stack: error.stack,
      digest: error.digest,
      source: "boundary:admin-dashboard",
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    }).then((res) => {
      if (res?.logId) setIncidentId(res.logId);
    });
  }, [error]);

  return (
    <div className="py-12 flex items-center justify-center">
      <div className="max-w-lg w-full bg-card/90 border border-border p-8 rounded-xl shadow-xl text-center space-y-6">
        <div className="w-12 h-12 mx-auto rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
          <AlertCircle className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Dashboard Module Error
          </h2>
          <p className="text-sm text-muted-foreground">
            A temporary problem occurred while loading this dashboard panel. The error has been captured in the system diagnostic logs.
          </p>
          {(error.digest || incidentId) && (
            <div className="text-xs font-mono text-muted-foreground bg-muted/40 p-2 rounded border border-border">
              Diagnostic Reference: <span className="font-semibold text-foreground">{incidentId || error.digest}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-center pt-2">
          <Button onClick={() => reset()} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Try Again
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" /> Dashboard Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
