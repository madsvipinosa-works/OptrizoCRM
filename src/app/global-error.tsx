"use client";

import { useEffect } from "react";
import { reportClientError } from "@/features/audit/actions";

export default function GlobalRootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      message: error.message || "Fatal root layout error",
      stack: error.stack,
      digest: error.digest,
      source: "boundary:global-root",
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "sans-serif", backgroundColor: "#0b0f17", color: "#f1f5f9" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ maxWidth: "480px", width: "100%", background: "#151c28", border: "1px solid #2d3748", borderRadius: "12px", padding: "32px", textAlign: "center" }}>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: "0 0 12px 0", color: "#ef4444" }}>
              Application Error
            </h1>
            <p style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "24px", lineHeight: "1.5" }}>
              A critical error interrupted the application. The system diagnostic team has been alerted.
            </p>
            {error.digest && (
              <p style={{ fontFamily: "monospace", fontSize: "12px", color: "#64748b", background: "#0f172a", padding: "8px", borderRadius: "6px", marginBottom: "24px" }}>
                Digest: {error.digest}
              </p>
            )}
            <button
              onClick={() => reset()}
              style={{ padding: "10px 20px", fontSize: "14px", fontWeight: 600, color: "#ffffff", background: "#3b82f6", border: "none", borderRadius: "8px", cursor: "pointer" }}
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
