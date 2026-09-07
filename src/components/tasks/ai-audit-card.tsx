import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Cpu, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface CriteriaItem {
  criterion: string;
  status: "PASS" | "FAIL" | "PARTIAL";
  notes: string;
}

export interface AIAuditCardProps {
  score: number;
  status: "Passed" | "Failed";
  summary: string;
  criteria: CriteriaItem[];
  submittedBy?: string | null;
  proofUrl?: string | null;
  createdAt?: Date | string | null;
}

export function AIAuditCard({
  score,
  status,
  summary,
  criteria,
  submittedBy,
  proofUrl,
}: AIAuditCardProps) {
  const isPassed = status === "Passed";
  const [isCriteriaCollapsed, setIsCriteriaCollapsed] = useState(false);

  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 text-sm backdrop-blur-md transition-all w-full overflow-hidden ${
        isPassed
          ? "border-emerald-500/30 bg-emerald-950/20 shadow-emerald-500/5 shadow-lg"
          : "border-amber-500/30 bg-amber-950/20 shadow-amber-500/5 shadow-lg"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/5">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div
            className={`p-2 rounded-lg border shrink-0 mt-0.5 sm:mt-0 ${
              isPassed
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}
          >
            {isPassed ? (
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold text-xs tracking-wider text-zinc-100 uppercase">
                System Quality Gate
              </h4>
              <Badge
                variant="outline"
                className={`text-[10px] font-semibold px-2 py-0.5 border shrink-0 ${
                  isPassed
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                }`}
              >
                {isPassed ? "Gate Passed" : "Changes Requested"}
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
              <Cpu className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>Automated Definition of Done (DoD)</span>
            </p>
          </div>
        </div>

        {/* Confidence Gauge */}
        <div className="flex items-center gap-3 bg-zinc-900/60 sm:bg-transparent p-2 sm:p-0 rounded-lg border border-zinc-800/40 sm:border-0 self-start sm:self-auto shrink-0">
          <div className="text-left sm:text-right">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-medium">
              Confidence Score
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`font-mono text-lg font-extrabold tracking-tight ${
                  score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-rose-400"
                }`}
              >
                {score}%
              </span>
              <div className="w-16 sm:w-20 h-2 rounded-full bg-zinc-800 overflow-hidden shrink-0">
                <div
                  className={`h-full rounded-full transition-all ${
                    score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="my-3.5 p-3.5 rounded-lg bg-zinc-900/70 border border-zinc-800/80 space-y-2.5">
        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal break-words [overflow-wrap:anywhere]">
          {summary}
        </p>
        {proofUrl && (
          <div className="pt-2.5 border-t border-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px]">
            <span className="text-zinc-400 font-medium shrink-0">Verified Artifact:</span>
            <a
              href={proofUrl.startsWith("http") ? proofUrl : `https://${proofUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline font-mono truncate break-all flex items-center gap-1.5 max-w-full group"
            >
              <span className="truncate">{proofUrl}</span>
              <ExternalLink className="w-3 h-3 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        )}
      </div>

      {/* Criteria Breakdown */}
      {criteria && criteria.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Acceptance Criteria Verification ({criteria.length}):
            </p>
            {criteria.length > 3 && (
              <button
                type="button"
                onClick={() => setIsCriteriaCollapsed(!isCriteriaCollapsed)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <span>{isCriteriaCollapsed ? "Expand All" : "Collapse"}</span>
                {isCriteriaCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>
            )}
          </div>

          {!isCriteriaCollapsed && (
            <div className="space-y-2">
              {criteria.map((item, idx) => {
                const isPass = item.status === "PASS";
                const isPartial = item.status === "PARTIAL";

                return (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/60 text-xs transition-colors hover:border-zinc-700/60"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        {isPass ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : isPartial ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <span className="font-medium text-zinc-200 break-words [overflow-wrap:anywhere] leading-snug">
                          {item.criterion}
                        </span>
                      </div>
                      {item.notes && (
                        <p className="text-[11px] text-zinc-400 pl-6 leading-relaxed break-words [overflow-wrap:anywhere]">
                          {item.notes}
                        </p>
                      )}
                    </div>

                    <span
                      className={`self-start sm:self-auto font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase border shrink-0 ${
                        isPass
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : isPartial
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer info */}
      {submittedBy && (
        <div className="mt-3.5 pt-2.5 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-zinc-500">
          <span className="truncate">
            Submitted by: <strong className="text-zinc-400">{submittedBy}</strong>
          </span>
          <span className="text-zinc-500 font-mono">System Gatekeeper v2</span>
        </div>
      )}
    </div>
  );
}

