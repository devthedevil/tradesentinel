import { NextResponse } from "next/server";

function wave(t: number, offset = 0): number {
  return Math.sin(t * 1.3 + offset) * 0.5 + Math.sin(t * 2.7 + offset) * 0.5;
}

const TOPICS = [
  { name: "order-events", partitions: 12, group: "order-processor", baseThru: 12400, baseLag: 0 },
  { name: "market-data", partitions: 24, group: "market-data-consumer", baseThru: 85000, baseLag: 3 },
  { name: "trade-executions", partitions: 6, group: "trade-recorder", baseThru: 3200, baseLag: 0 },
  { name: "risk-signals", partitions: 4, group: "risk-evaluator", baseThru: 890, baseLag: 0 },
  { name: "position-updates", partitions: 8, group: "position-manager", baseThru: 4500, baseLag: 1 },
  { name: "audit-log", partitions: 3, group: "audit-writer", baseThru: 210, baseLag: 0 },
];

export async function GET() {
  const t = Date.now() / 1000;

  const topics = TOPICS.map((topic, i) => {
    const lagSpike = Math.sin(t * 0.05 + i * 1.2) > 0.8 ? Math.floor(Math.random() * 60) : 0;
    const lag = Math.max(0, topic.baseLag + lagSpike);
    return {
      name: topic.name,
      partitions: topic.partitions,
      consumerGroup: topic.group,
      throughput: Math.round(topic.baseThru + wave(t, i) * topic.baseThru * 0.08),
      lag,
      partitionDetail: Array.from({ length: Math.min(topic.partitions, 6) }, (_, p) => ({
        partition: p,
        lag: lag > 0 ? Math.max(0, Math.round(lagSpike * Math.random())) : 0,
      })),
    };
  });

  const history = Array.from({ length: 20 }, (_, i) => {
    const ts = (Date.now() - (19 - i) * 3000) / 1000;
    return {
      time: new Date(Date.now() - (19 - i) * 3000).toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }),
      "order-events": Math.round(12400 + wave(ts, 0) * 1200),
      "market-data": Math.round(85000 + wave(ts, 1) * 7000),
      "trade-executions": Math.round(3200 + wave(ts, 2) * 280),
    };
  });

  return NextResponse.json({ topics, history });
}
