"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import clsx from "clsx";

interface Pod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  cpu: string;
  memory: string;
  age: string;
  node: string;
}

interface PodsData {
  pods: Pod[];
  totalPods: number;
  runningPods: number;
}

function statusBadge(s: string) {
  if (s === "Running")
    return "bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/30";
  if (s === "CrashLoopBackOff")
    return "bg-[#f85149]/10 text-[#f85149] border-[#f85149]/30";
  return "bg-[#d29922]/10 text-[#d29922] border-[#d29922]/30";
}

export default function InfrastructurePage() {
  const [data, setData] = useState<PodsData | null>(null);
  const [ns, setNs] = useState("all");
  const [spinning, setSpinning] = useState(false);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/pods");
      setData(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = async () => {
    setSpinning(true);
    await fetch_();
    setTimeout(() => setSpinning(false), 600);
  };

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 5000);
    return () => clearInterval(id);
  }, [fetch_]);

  const namespaces = ["all", "trading", "streaming", "monitoring"];
  const pods =
    data?.pods.filter((p) => ns === "all" || p.namespace === ns) ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-[#e6edf3]">
            Kubernetes Infrastructure
          </h1>
          <p className="text-xs text-[#8b949e] mt-0.5">
            Pod status across all namespaces · Refresh: 5s
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-sm font-mono">
              <span className="text-[#3fb950]">{data.runningPods}</span>
              <span className="text-[#8b949e]"> / {data.totalPods} running</span>
            </span>
          )}
          <button
            onClick={refresh}
            className="p-1.5 rounded bg-[#21262d] hover:bg-[#30363d] transition-colors"
          >
            <RefreshCw
              className={clsx("w-4 h-4 text-[#8b949e]", spinning && "animate-spin")}
            />
          </button>
        </div>
      </div>

      {/* Namespace filter */}
      <div className="flex gap-2 mb-4">
        {namespaces.map((n) => (
          <button
            key={n}
            onClick={() => setNs(n)}
            className={clsx(
              "px-3 py-1 rounded text-xs font-medium transition-colors border",
              ns === n
                ? "bg-[#58a6ff]/10 text-[#58a6ff] border-[#58a6ff]/30"
                : "bg-[#161b22] text-[#8b949e] border-[#30363d] hover:border-[#484f58]"
            )}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Pods table */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#30363d]">
                {[
                  "Name",
                  "Namespace",
                  "Status",
                  "Ready",
                  "CPU",
                  "Memory",
                  "Restarts",
                  "Node",
                  "Age",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[#8b949e] font-medium uppercase tracking-wider text-[10px]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pods.map((pod) => (
                <tr
                  key={pod.name}
                  className={clsx(
                    "border-b border-[#21262d] hover:bg-[#21262d] transition-colors",
                    pod.status !== "Running" && "bg-[#f85149]/5"
                  )}
                >
                  <td className="px-4 py-3 font-mono text-[#e6edf3]">
                    <div className="flex items-center gap-2">
                      {pod.status !== "Running" && (
                        <AlertCircle className="w-3 h-3 text-[#f85149] flex-shrink-0" />
                      )}
                      <span className="truncate max-w-[150px]">{pod.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#8b949e]">{pod.namespace}</td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "border rounded px-1.5 py-0.5 text-[10px] font-medium",
                        statusBadge(pod.status)
                      )}
                    >
                      {pod.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">{pod.ready}</td>
                  <td className="px-4 py-3 font-mono text-[#e6edf3]">{pod.cpu}</td>
                  <td className="px-4 py-3 font-mono text-[#e6edf3]">{pod.memory}</td>
                  <td
                    className={clsx(
                      "px-4 py-3 font-mono",
                      pod.restarts > 0 ? "text-[#d29922]" : "text-[#e6edf3]"
                    )}
                  >
                    {pod.restarts}
                  </td>
                  <td className="px-4 py-3 text-[#8b949e]">{pod.node}</td>
                  <td className="px-4 py-3 text-[#8b949e]">{pod.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* HPA snippet */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
        <h3 className="text-sm font-medium text-[#e6edf3] mb-3">
          Horizontal Pod Autoscaler — order-router
        </h3>
        <pre className="text-xs text-[#3fb950] font-mono overflow-x-auto bg-[#0d1117] rounded p-4 leading-relaxed">
{`apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-router-hpa
  namespace: trading
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-router
  minReplicas: 3
  maxReplicas: 12
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80`}
        </pre>
      </div>
    </div>
  );
}
