"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
} from "lucide-react";
import clsx from "clsx";

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  rule: string;
  message: string;
  time: string;
  duration: string;
  status: "firing" | "resolved";
}

interface AlertData {
  alerts: Alert[];
  resolved: Alert[];
  total: number;
  critical: number;
}

const SEV = {
  critical: {
    Icon: AlertCircle,
    color: "text-[#f85149]",
    bg: "bg-[#f85149]/8",
    border: "border-[#f85149]/40",
    badge: "bg-[#f85149] text-white",
  },
  warning: {
    Icon: AlertTriangle,
    color: "text-[#d29922]",
    bg: "bg-[#d29922]/8",
    border: "border-[#d29922]/30",
    badge: "bg-[#d29922] text-black",
  },
  info: {
    Icon: Info,
    color: "text-[#58a6ff]",
    bg: "bg-[#58a6ff]/8",
    border: "border-[#58a6ff]/30",
    badge: "bg-[#58a6ff] text-white",
  },
};

function AlertRow({ alert }: { alert: Alert }) {
  const cfg = SEV[alert.severity];
  const { Icon } = cfg;
  return (
    <div className={clsx("border rounded-lg p-4", cfg.border, cfg.bg)}>
      <div className="flex items-start gap-3">
        <Icon className={clsx("w-4 h-4 mt-0.5 flex-shrink-0", cfg.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium text-[#e6edf3] font-mono">
              {alert.rule}
            </span>
            <span
              className={clsx(
                "text-[10px] rounded px-1.5 py-0.5 font-medium",
                cfg.badge
              )}
            >
              {alert.severity}
            </span>
            {alert.status === "firing" && (
              <span className="ml-auto flex items-center gap-1.5 text-[10px] text-[#f85149]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#f85149] pulse-red" />
                FIRING · {alert.duration}
              </span>
            )}
          </div>
          <p className="text-xs text-[#8b949e] mb-1.5">{alert.message}</p>
          <p className="text-[10px] text-[#484f58]">Triggered at {alert.time}</p>
        </div>
      </div>
    </div>
  );
}

const PROM_RULES = `groups:
  - name: trading.rules
    rules:
    - alert: HighExecutionLatencyP99
      expr: histogram_quantile(0.99,
              rate(order_execution_latency_seconds_bucket[1m])) > 0.03
      for: 1m
      labels:
        severity: warning
      annotations:
        summary: "P99 latency above 30ms"

    - alert: PodCrashLoopBackOff
      expr: kube_pod_container_status_waiting_reason{
              namespace=~"trading|streaming",
              reason="CrashLoopBackOff"} == 1
      for: 2m
      labels:
        severity: critical

    - alert: KafkaConsumerLag
      expr: kafka_consumergroup_lag{namespace="trading"} > 100
      for: 30s
      labels:
        severity: warning

    - alert: HighRejectionRate
      expr: rate(orders_rejected_total[5m])
              / rate(orders_total[5m]) > 0.01
      for: 2m
      labels:
        severity: warning`;

export default function AlertsPage() {
  const [data, setData] = useState<AlertData | null>(null);

  const fetch_ = useCallback(async () => {
    const res = await fetch("/api/alerts");
    setData(await res.json());
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 5000);
    return () => clearInterval(id);
  }, [fetch_]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-[#e6edf3]">
            Alert Management
          </h1>
          <p className="text-xs text-[#8b949e] mt-0.5">
            Prometheus alerting rules · Refresh: 5s
          </p>
        </div>
        {data && (
          <div className="flex gap-3">
            {data.critical > 0 && (
              <div className="bg-[#f85149]/10 border border-[#f85149]/30 rounded px-3 py-1.5">
                <span className="text-xs text-[#f85149] font-semibold">
                  {data.critical} Critical
                </span>
              </div>
            )}
            <div className="bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5">
              <span className="text-xs text-[#8b949e]">{data.total} Firing</span>
            </div>
          </div>
        )}
      </div>

      {/* Firing */}
      <div className="mb-6">
        <h2 className="text-[10px] font-semibold text-[#8b949e] uppercase tracking-widest mb-3">
          Firing Alerts
        </h2>
        <div className="space-y-3">
          {data?.alerts.length === 0 ? (
            <div className="bg-[#161b22] border border-[#3fb950]/30 rounded-lg p-6 text-center">
              <CheckCircle className="w-8 h-8 text-[#3fb950] mx-auto mb-2" />
              <p className="text-sm text-[#3fb950]">All systems operational</p>
            </div>
          ) : (
            data?.alerts.map((a) => <AlertRow key={a.id} alert={a} />)
          )}
        </div>
      </div>

      {/* Resolved */}
      <div className="mb-6">
        <h2 className="text-[10px] font-semibold text-[#8b949e] uppercase tracking-widest mb-3">
          Recently Resolved
        </h2>
        <div className="space-y-2 opacity-60">
          {data?.resolved.map((a) => (
            <div
              key={a.id}
              className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 flex items-start gap-3"
            >
              <CheckCircle className="w-4 h-4 text-[#3fb950] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-[#e6edf3] font-mono">
                  {a.rule}
                </p>
                <p className="text-xs text-[#8b949e]">{a.message}</p>
                <p className="text-[10px] text-[#484f58] mt-1">
                  Resolved {a.time} · Duration: {a.duration}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prometheus rules */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
        <h3 className="text-sm font-medium text-[#e6edf3] mb-3">
          Active Prometheus Alert Rules
        </h3>
        <pre className="text-xs text-[#3fb950] font-mono overflow-x-auto bg-[#0d1117] rounded p-4 leading-relaxed">
          {PROM_RULES}
        </pre>
      </div>
    </div>
  );
}
