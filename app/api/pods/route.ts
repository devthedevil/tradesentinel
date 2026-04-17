import { NextResponse } from "next/server";

const TEMPLATES = [
  { name: "order-router", ns: "trading", n: 3, cpu: [120, 180, 145], mem: [256, 312, 289] },
  { name: "market-data-feed", ns: "trading", n: 2, cpu: [340, 298], mem: [512, 487] },
  { name: "risk-engine", ns: "trading", n: 2, cpu: [89, 102], mem: [768, 721] },
  { name: "execution-gateway", ns: "trading", n: 3, cpu: [210, 195, 223], mem: [384, 401, 376] },
  { name: "position-tracker", ns: "trading", n: 1, cpu: [67], mem: [192] },
  { name: "prometheus", ns: "monitoring", n: 1, cpu: [45], mem: [512] },
  { name: "kafka-broker", ns: "streaming", n: 3, cpu: [380, 412, 395], mem: [1024, 1156, 998] },
  { name: "zookeeper", ns: "streaming", n: 1, cpu: [23], mem: [256] },
];

function suffix() {
  return Math.random().toString(36).substring(2, 9);
}

export async function GET() {
  const t = Date.now() / 1000;
  const incident = Math.sin(t * 0.03) > 0.9;

  const pods = TEMPLATES.flatMap((tpl) =>
    Array.from({ length: tpl.n }, (_, i) => {
      const crashed = incident && tpl.name === "order-router" && i === 2;
      return {
        name: `${tpl.name}-${suffix()}`,
        namespace: tpl.ns,
        status: crashed ? "CrashLoopBackOff" : "Running",
        ready: crashed ? "0/1" : "1/1",
        restarts: crashed ? Math.floor(Math.random() * 4) + 2 : 0,
        cpu: `${tpl.cpu[i]}m`,
        memory: `${tpl.mem[i]}Mi`,
        age: `${Math.floor(Math.random() * 6) + 1}d`,
        node: `node-${(i % 3) + 1}`,
      };
    })
  );

  return NextResponse.json({
    pods,
    totalPods: pods.length,
    runningPods: pods.filter((p) => p.status === "Running").length,
  });
}
