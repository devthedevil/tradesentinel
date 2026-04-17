"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, AlertTriangle, Zap, CheckCircle, TrendingUp } from "lucide-react";
import dynamic from "next/dynamic";
import clsx from "clsx";

const LatencyChart = dynamic(() => import("@/components/LatencyChart"), { ssr: false });
const ThroughputChart = dynamic(() => import("@/components/ThroughputChart"), { ssr: false });

interface HistoryPoint {
  time: string;
  p50: number;
  p95: number;
  p99: number;
  throughput: number;
}

interface Metrics {
  ordersPerSecond: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  fillRate: number;
  rejectionRate: number;
  uptime: number;
  activeAlerts: number;
  history: HistoryPoint[];
}

function LiveClock() {
  const [time, setTime] = useState("--:--:--");
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "America/Chicago",
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-sm text-[#3fb950]">{time} CT</span>;
}

function KpiCard({
  title,
  value,
  unit,
  sub,
  status = "normal",
  Icon,
  trend,
}: {
  title: string;
  value: string | number;
  unit?: string;
  sub?: string;
  status?: "normal" | "good" | "warning" | "critical";
  Icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | null;
}) {
  const valueColor = {
    normal: "text-[#58a6ff]",
    good: "text-[#3fb950]",
    warning: "text-[#d29922]",
    critical: "text-[#f85149]",
  }[status];

  const borderColor = {
    normal: "border-[#30363d]",
    good: "border-[#3fb950]/30",
    warning: "border-[#d29922]/30",
    critical: "border-[#f85149]/40",
  }[status];

  return (
    <div className={clsx("bg-[#161b22] rounded-lg p-4 border transition-all", borderColor)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#8b949e] text-[11px] font-medium uppercase tracking-wider">
          {title}
        </span>
        <Icon className={clsx("w-4 h-4", valueColor)} />
      </div>
      <div className="flex items-end gap-1">
        <span className={clsx("text-2xl font-bold font-mono", valueColor)}>{value}</span>
        {unit && <span className="text-[#8b949e] text-sm mb-0.5">{unit}</span>}
        {trend === "up" && (
          <TrendingUp className="w-4 h-4 text-[#f85149] mb-0.5 ml-1" />
        )}
      </div>
      {sub && <p className="text-[#8b949e] text-xs mt-1">{sub}</p>}
    </div>
  );
}

const COMPONENTS = [
  { name: "Order Router", status: "operational", latency: "2.3ms" },
  { name: "Risk Engine", status: "operational", latency: "1.1ms" },
  { name: "Market Data Feed", status: "degraded", latency: "8.7ms" },
  { name: "Execution Gateway", status: "operational", latency: "3.4ms" },
  { name: "Position Tracker", status: "operational", latency: "0.8ms" },
  { name: "Prometheus", status: "operational", latency: "—" },
];

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics");
      setMetrics(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 2000);
    return () => clearInterval(id);
  }, [fetch_]);

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#8b949e] text-sm font-mono">Connecting to metrics stream...</div>
      </div>
    );
  }

  const latStatus =
    metrics.p99Latency > 45 ? "critical" : metrics.p99Latency > 30 ? "warning" : "good";
  const alertStatus =
    metrics.activeAlerts > 2 ? "critical" : metrics.activeAlerts > 0 ? "warning" : "good";

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-[#e6edf3]">
            Trading Operations Overview
          </h1>
          <p className="text-xs text-[#8b949e] mt-0.5">
            Real-time infrastructure monitoring · Auto-refresh: 2s
          </p>
        </div>
        <div className="flex items-center gap-4">
          <LiveClock />
          <div className="flex items-center gap-2 bg-[#161b22] border border-[#3fb950]/30 rounded px-3 py-1.5">
            <div className="w-2 h-2 rounded-full bg-[#3fb950] pulse-green" />
            <span className="text-xs text-[#3fb950] font-semibold">NYSE OPEN</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Orders / Second"
          value={metrics.ordersPerSecond.toLocaleString()}
          unit="ord/s"
          sub={`Fill rate: ${metrics.fillRate}%`}
          status="good"
          Icon={Zap}
        />
        <KpiCard
          title="P99 Latency"
          value={metrics.p99Latency}
          unit="ms"
          sub={`P95: ${metrics.p95Latency}ms · P50: ${metrics.p50Latency}ms`}
          status={latStatus}
          Icon={Clock}
          trend={metrics.p99Latency > 35 ? "up" : null}
        />
        <KpiCard
          title="System Uptime"
          value={metrics.uptime}
          unit="%"
          sub="30-day rolling SLA"
          status="good"
          Icon={CheckCircle}
        />
        <KpiCard
          title="Active Alerts"
          value={metrics.activeAlerts}
          sub={`Rejection rate: ${(metrics.rejectionRate * 100).toFixed(2)}%`}
          status={alertStatus}
          Icon={AlertTriangle}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h3 className="text-sm font-medium text-[#e6edf3] mb-0.5">
            Execution Latency Percentiles
          </h3>
          <p className="text-xs text-[#8b949e] mb-4">P50 / P95 / P99 — last 60s</p>
          <LatencyChart data={metrics.history} />
        </div>
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h3 className="text-sm font-medium text-[#e6edf3] mb-0.5">Order Throughput</h3>
          <p className="text-xs text-[#8b949e] mb-4">Orders per second — last 60s</p>
          <ThroughputChart data={metrics.history} />
        </div>
      </div>

      {/* Component Status */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#e6edf3]">System Component Status</h3>
          <span className="text-[10px] text-[#484f58] font-mono">
            updated {new Date().toLocaleTimeString()}
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {COMPONENTS.map((c) => (
            <div key={c.name} className="bg-[#21262d] rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={clsx(
                    "w-2 h-2 rounded-full",
                    c.status === "operational" ? "bg-[#3fb950]" : "bg-[#d29922]"
                  )}
                />
                <span className="text-xs text-[#e6edf3] font-medium truncate">{c.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span
                  className={clsx(
                    "text-[10px]",
                    c.status === "operational" ? "text-[#3fb950]" : "text-[#d29922]"
                  )}
                >
                  {c.status}
                </span>
                <span className="text-[10px] text-[#8b949e] font-mono">{c.latency}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
