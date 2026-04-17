import { NextResponse } from "next/server";

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  rule: string;
  message: string;
  time: string;
  duration: string;
  status: "firing" | "resolved";
}

const BASE_ALERTS: Alert[] = [
  {
    id: "a-001",
    severity: "warning",
    rule: "HighExecutionLatencyP99",
    message: "P99 execution latency exceeded 30ms threshold (current: 31.2ms)",
    time: new Date(Date.now() - 8 * 60 * 1000).toLocaleTimeString("en-US", { hour12: false }),
    duration: "8m 23s",
    status: "firing",
  },
  {
    id: "a-002",
    severity: "info",
    rule: "KafkaConsumerLag",
    message: "Consumer group market-data-consumer lag above 5 on market-data topic",
    time: new Date(Date.now() - 2 * 60 * 1000).toLocaleTimeString("en-US", { hour12: false }),
    duration: "2m 01s",
    status: "firing",
  },
];

const INCIDENT_ALERTS: Alert[] = [
  {
    id: "a-crit",
    severity: "critical",
    rule: "PodCrashLoopBackOff",
    message: "Pod order-router in namespace trading is in CrashLoopBackOff (restarts: 4)",
    time: new Date().toLocaleTimeString("en-US", { hour12: false }),
    duration: "0m 45s",
    status: "firing",
  },
];

const RESOLVED: Alert[] = [
  {
    id: "r-001",
    severity: "warning",
    rule: "HighRejectionRate",
    message: "Order rejection rate exceeded 1% threshold — auto-remediated",
    time: new Date(Date.now() - 45 * 60 * 1000).toLocaleTimeString("en-US", { hour12: false }),
    duration: "4m 12s",
    status: "resolved",
  },
  {
    id: "r-002",
    severity: "info",
    rule: "KafkaConsumerLag",
    message: "Consumer group trade-recorder lag resolved after partition rebalance",
    time: new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleTimeString("en-US", { hour12: false }),
    duration: "1m 34s",
    status: "resolved",
  },
];

export async function GET() {
  const t = Date.now() / 1000;
  const incident = Math.sin(t * 0.03) > 0.9;
  const alerts = incident ? [...INCIDENT_ALERTS, ...BASE_ALERTS] : BASE_ALERTS;

  return NextResponse.json({
    alerts,
    resolved: RESOLVED,
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
  });
}
