import { NextResponse } from "next/server";

function wave(t: number, freq = 1, scale = 1): number {
  return (Math.sin(t * freq) * 0.6 + Math.sin(t * freq * 1.9) * 0.4) * scale;
}

function generateHistory(points = 30) {
  const now = Date.now();
  return Array.from({ length: points }, (_, i) => {
    const t = (now - (points - 1 - i) * 2000) / 1000;
    const spike = Math.sin(t * 0.03) > 0.9 ? 22 : 0;
    return {
      time: new Date(now - (points - 1 - i) * 2000).toLocaleTimeString(
        "en-US",
        { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }
      ),
      p50: parseFloat((2.3 + wave(t, 0.4, 0.5) + spike * 0.06).toFixed(2)),
      p95: parseFloat((11.2 + wave(t, 0.3, 2.5) + spike * 0.3).toFixed(2)),
      p99: parseFloat((27.5 + wave(t, 0.2, 5.5) + spike).toFixed(2)),
      throughput: Math.max(
        900,
        Math.round(1247 + wave(t, 0.5, 190) + Math.random() * 30)
      ),
    };
  });
}

export async function GET() {
  const t = Date.now() / 1000;
  const spike = Math.sin(t * 0.03) > 0.9 ? 22 : 0;

  return NextResponse.json({
    ordersPerSecond: Math.max(
      900,
      Math.round(1247 + wave(t, 0.5, 190) + Math.random() * 30)
    ),
    p50Latency: parseFloat((2.3 + wave(t, 0.4, 0.5) + spike * 0.06).toFixed(2)),
    p95Latency: parseFloat((11.2 + wave(t, 0.3, 2.5) + spike * 0.3).toFixed(2)),
    p99Latency: parseFloat((27.5 + wave(t, 0.2, 5.5) + spike).toFixed(2)),
    fillRate: parseFloat((98.71 + wave(t, 0.1, 0.25)).toFixed(2)),
    rejectionRate: parseFloat(
      Math.max(0, 0.31 + wave(t, 0.2, 0.07)).toFixed(3)
    ),
    uptime: 99.97,
    activeAlerts: spike > 0 ? 3 : 2,
    history: generateHistory(30),
  });
}
