"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/features/audit/actions";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [incidentId, setIncidentId] = useState<string | null>(null);

  useEffect(() => {
    // Automatically capture and record the unhandled exception
    reportClientError({
      message: error.message || "Unhandled client route rendering error",
      stack: error.stack,
      digest: error.digest,
      source: "boundary:app-route",
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    }).then((res) => {
      if (res?.logId) {
        setIncidentId(res.logId);
      }
    });
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card/80 backdrop-blur-md border border-border p-8 rounded-xl shadow-2xl text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred while rendering this page. Our diagnostic system has been notified.
          </p>
          {(error.digest || incidentId) && (
            <p className="text-xs font-mono text-muted-foreground/80 bg-muted/30 p-2 rounded border border-border">
              Reference ID: {incidentId ? incidentId.slice(0, 8) : error.digest || "UNKNOWN"}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            onClick={() => reset()}
            variant="default"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Try Again
          </Button>
          <Button asChild variant="outline">
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-4 w-4" /> Return Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
